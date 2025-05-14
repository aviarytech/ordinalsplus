/**
 * Credential Repository
 * 
 * This module provides repository interfaces and implementations for securely storing
 * and managing verifiable credentials with efficient indexing and retrieval.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { VerifiableCredential } from '../types/verifiableCredential';

/**
 * Index structure for credential storage
 * Each index maps a key to an array of credential IDs
 */
interface CredentialIndex {
  byId: Map<string, string>; // Map of credential ID to internal storage key
  bySubject: Map<string, Set<string>>; // Map of subject DID to credential IDs
  byIssuer: Map<string, Set<string>>; // Map of issuer DID to credential IDs
  byType: Map<string, Set<string>>; // Map of credential type to credential IDs
  byInscription: Map<string, Set<string>>; // Map of inscription ID to credential IDs
}

/**
 * Repository interface for credential storage
 */
export interface CredentialRepository {
  /**
   * Store a credential in the repository
   * 
   * @param credential - The verifiable credential to store
   * @param metadata - Optional metadata for the credential (such as inscription association)
   * @returns The ID of the stored credential
   */
  storeCredential(credential: VerifiableCredential, metadata?: CredentialMetadata): Promise<string>;

  /**
   * Retrieve a credential by its ID
   * 
   * @param id - The credential ID
   * @returns The credential if found, null otherwise
   */
  getCredentialById(id: string): Promise<CredentialWithMetadata | null>;

  /**
   * Find credentials by subject DID
   * 
   * @param subjectDid - The subject DID to search for
   * @returns Array of matching credentials
   */
  findCredentialsBySubject(subjectDid: string): Promise<CredentialWithMetadata[]>;

  /**
   * Find credentials by issuer DID
   * 
   * @param issuerDid - The issuer DID to search for
   * @returns Array of matching credentials
   */
  findCredentialsByIssuer(issuerDid: string): Promise<CredentialWithMetadata[]>;

  /**
   * Find credentials by type
   * 
   * @param type - The credential type to search for
   * @returns Array of matching credentials
   */
  findCredentialsByType(type: string): Promise<CredentialWithMetadata[]>;

  /**
   * Find credentials associated with an inscription
   * 
   * @param inscriptionId - The inscription ID to search for
   * @returns Array of matching credentials
   */
  findCredentialsByInscription(inscriptionId: string): Promise<CredentialWithMetadata[]>;

  /**
   * Update a credential in the repository
   * 
   * @param id - The credential ID to update
   * @param credential - The updated credential
   * @param metadata - Optional updated metadata
   * @returns Whether the update was successful
   */
  updateCredential(id: string, credential: VerifiableCredential, metadata?: CredentialMetadata): Promise<boolean>;

  /**
   * Delete a credential from the repository
   * 
   * @param id - The credential ID to delete
   * @returns Whether the deletion was successful
   */
  deleteCredential(id: string): Promise<boolean>;

  /**
   * Create a backup of the credential store
   * 
   * @param backupPath - Path to store the backup
   * @returns Whether the backup was successful
   */
  createBackup(backupPath: string): Promise<boolean>;

  /**
   * Restore from a backup
   * 
   * @param backupPath - Path to the backup file
   * @returns Whether the restore was successful
   */
  restoreFromBackup(backupPath: string): Promise<boolean>;

  /**
   * Get statistics about the credential store
   * 
   * @returns Statistics about the store
   */
  getStats(): Promise<CredentialStoreStats>;
}

/**
 * Metadata for credentials, such as associations with inscriptions
 */
export interface CredentialMetadata {
  /** Associated inscription ID */
  inscriptionId?: string;
  /** Date when the credential was stored */
  storedAt?: string;
  /** Additional custom metadata properties */
  [key: string]: any;
}

/**
 * Credential with its metadata
 */
export interface CredentialWithMetadata {
  /** The credential itself */
  credential: VerifiableCredential;
  /** Metadata associated with the credential */
  metadata: CredentialMetadata;
}

/**
 * Statistics about the credential store
 */
export interface CredentialStoreStats {
  /** Total number of credentials in the store */
  totalCredentials: number;
  /** Number of unique subject DIDs */
  uniqueSubjects: number;
  /** Number of unique issuers */
  uniqueIssuers: number;
  /** Number of unique credential types */
  uniqueTypes: number;
  /** Is encryption enabled */
  encryptionEnabled: boolean;
}

/**
 * Configuration for the in-memory credential repository
 */
export interface InMemoryCredentialRepositoryConfig {
  /** Whether to encrypt stored credentials */
  enableEncryption?: boolean;
  /** Encryption key when encryption is enabled (must be 32 bytes for AES-256) */
  encryptionKey?: string;
  /** Path for persistence file */
  persistencePath?: string;
  /** Auto-save interval in milliseconds (0 to disable) */
  autoSaveIntervalMs?: number;
}

/**
 * In-memory implementation of CredentialRepository
 * 
 * This repository stores credentials in memory with optional encryption.
 * It can also persist to disk and load from disk for semi-durability.
 */
export class InMemoryCredentialRepository implements CredentialRepository {
  private credentials: Map<string, string> = new Map(); // Map of storage keys to encrypted/raw credential JSON
  private metadata: Map<string, CredentialMetadata> = new Map(); // Map of credential IDs to metadata
  private index: CredentialIndex = {
    byId: new Map(),
    bySubject: new Map(),
    byIssuer: new Map(),
    byType: new Map(),
    byInscription: new Map()
  };
  private config: InMemoryCredentialRepositoryConfig;
  private autoSaveTimer?: NodeJS.Timer;

  /**
   * Create a new in-memory credential repository
   * 
   * @param config - Configuration options
   */
  constructor(config: InMemoryCredentialRepositoryConfig = {}) {
    this.config = {
      enableEncryption: config.enableEncryption || false,
      encryptionKey: config.encryptionKey,
      persistencePath: config.persistencePath,
      autoSaveIntervalMs: config.autoSaveIntervalMs || 0
    };

    // Validate encryption configuration
    if (this.config.enableEncryption && (!this.config.encryptionKey || this.config.encryptionKey.length !== 32)) {
      throw new Error('When encryption is enabled, a 32-byte encryption key must be provided');
    }

    // Set up auto-saving if configured
    if (this.config.persistencePath && this.config.autoSaveIntervalMs && this.config.autoSaveIntervalMs > 0) {
      this.autoSaveTimer = setInterval(() => {
        this.createBackup(this.config.persistencePath as string)
          .catch(err => console.error('Error auto-saving credential repository:', err));
      }, this.config.autoSaveIntervalMs);
    }
  }

  /**
   * Store a credential in the repository
   * 
   * @param credential - The verifiable credential to store
   * @param metadata - Optional metadata for the credential
   * @returns The ID of the stored credential
   */
  async storeCredential(credential: VerifiableCredential, metadata: CredentialMetadata = {}): Promise<string> {
    try {
      // Ensure credential has an ID
      const credentialId = credential.id || this.generateCredentialId(credential);
      
      // Add metadata
      const fullMetadata: CredentialMetadata = {
        ...metadata,
        storedAt: new Date().toISOString()
      };
      
      // Encrypt and store credential
      const storageKey = this.generateStorageKey();
      const credentialString = JSON.stringify(credential);
      
      let storedValue: string;
      if (this.config.enableEncryption && this.config.encryptionKey) {
        storedValue = this.encryptData(credentialString, this.config.encryptionKey);
      } else {
        storedValue = credentialString;
      }
      
      this.credentials.set(storageKey, storedValue);
      this.metadata.set(credentialId, fullMetadata);
      
      // Index the credential
      this.indexCredential(credentialId, credential, storageKey, fullMetadata);
      
      return credentialId;
    } catch (error) {
      console.error('Error storing credential:', error);
      throw new Error(`Failed to store credential: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieve a credential by its ID
   * 
   * @param id - The credential ID
   * @returns The credential if found, null otherwise
   */
  async getCredentialById(id: string): Promise<CredentialWithMetadata | null> {
    try {
      const storageKey = this.index.byId.get(id);
      if (!storageKey) {
        return null;
      }
      
      const encryptedOrRawCredential = this.credentials.get(storageKey);
      if (!encryptedOrRawCredential) {
        return null;
      }
      
      let credentialString: string;
      if (this.config.enableEncryption && this.config.encryptionKey) {
        credentialString = this.decryptData(encryptedOrRawCredential, this.config.encryptionKey);
      } else {
        credentialString = encryptedOrRawCredential;
      }
      
      const credential = JSON.parse(credentialString) as VerifiableCredential;
      const metadata = this.metadata.get(id) || {};
      
      return { credential, metadata };
    } catch (error) {
      console.error(`Error retrieving credential ${id}:`, error);
      return null;
    }
  }

  /**
   * Find credentials by subject DID
   * 
   * @param subjectDid - The subject DID to search for
   * @returns Array of matching credentials
   */
  async findCredentialsBySubject(subjectDid: string): Promise<CredentialWithMetadata[]> {
    const credentialIds = this.index.bySubject.get(subjectDid) || new Set<string>();
    const results: CredentialWithMetadata[] = [];
    
    for (const id of credentialIds) {
      const result = await this.getCredentialById(id);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }

  /**
   * Find credentials by issuer DID
   * 
   * @param issuerDid - The issuer DID to search for
   * @returns Array of matching credentials
   */
  async findCredentialsByIssuer(issuerDid: string): Promise<CredentialWithMetadata[]> {
    const credentialIds = this.index.byIssuer.get(issuerDid) || new Set<string>();
    const results: CredentialWithMetadata[] = [];
    
    for (const id of credentialIds) {
      const result = await this.getCredentialById(id);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }

  /**
   * Find credentials by type
   * 
   * @param type - The credential type to search for
   * @returns Array of matching credentials
   */
  async findCredentialsByType(type: string): Promise<CredentialWithMetadata[]> {
    const credentialIds = this.index.byType.get(type) || new Set<string>();
    const results: CredentialWithMetadata[] = [];
    
    for (const id of credentialIds) {
      const result = await this.getCredentialById(id);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }

  /**
   * Find credentials associated with an inscription
   * 
   * @param inscriptionId - The inscription ID to search for
   * @returns Array of matching credentials
   */
  async findCredentialsByInscription(inscriptionId: string): Promise<CredentialWithMetadata[]> {
    const credentialIds = this.index.byInscription.get(inscriptionId) || new Set<string>();
    const results: CredentialWithMetadata[] = [];
    
    for (const id of credentialIds) {
      const result = await this.getCredentialById(id);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }

  /**
   * Update a credential in the repository
   * 
   * @param id - The credential ID to update
   * @param credential - The updated credential
   * @param metadata - Optional updated metadata
   * @returns Whether the update was successful
   */
  async updateCredential(id: string, credential: VerifiableCredential, metadata?: CredentialMetadata): Promise<boolean> {
    try {
      // Check if credential exists
      const storageKey = this.index.byId.get(id);
      if (!storageKey) {
        return false;
      }
      
      // Remove old indexes
      const oldCredential = await this.getCredentialById(id);
      if (oldCredential) {
        this.removeCredentialFromIndexes(id, oldCredential.credential, oldCredential.metadata);
      } else {
        return false;
      }
      
      // Update metadata
      const oldMetadata = this.metadata.get(id) || {};
      const updatedMetadata: CredentialMetadata = {
        ...oldMetadata,
        ...metadata,
        updatedAt: new Date().toISOString()
      };
      this.metadata.set(id, updatedMetadata);
      
      // Store updated credential
      const credentialString = JSON.stringify(credential);
      
      let storedValue: string;
      if (this.config.enableEncryption && this.config.encryptionKey) {
        storedValue = this.encryptData(credentialString, this.config.encryptionKey);
      } else {
        storedValue = credentialString;
      }
      
      this.credentials.set(storageKey, storedValue);
      
      // Re-index the credential
      this.indexCredential(id, credential, storageKey, updatedMetadata);
      
      return true;
    } catch (error) {
      console.error(`Error updating credential ${id}:`, error);
      return false;
    }
  }

  /**
   * Delete a credential from the repository
   * 
   * @param id - The credential ID to delete
   * @returns Whether the deletion was successful
   */
  async deleteCredential(id: string): Promise<boolean> {
    try {
      // Check if credential exists
      const storageKey = this.index.byId.get(id);
      if (!storageKey) {
        return false;
      }
      
      // Get credential for index removal
      const credential = await this.getCredentialById(id);
      if (!credential) {
        return false;
      }
      
      // Remove from indexes
      this.removeCredentialFromIndexes(id, credential.credential, credential.metadata);
      
      // Remove from storage
      this.credentials.delete(storageKey);
      this.metadata.delete(id);
      this.index.byId.delete(id);
      
      return true;
    } catch (error) {
      console.error(`Error deleting credential ${id}:`, error);
      return false;
    }
  }

  /**
   * Create a backup of the credential store
   * 
   * @param backupPath - Path to store the backup
   * @returns Whether the backup was successful
   */
  async createBackup(backupPath: string): Promise<boolean> {
    try {
      // Create a serializable representation of the repository state
      const backupData = {
        credentials: Object.fromEntries(this.credentials.entries()),
        metadata: Object.fromEntries(this.metadata.entries()),
        index: {
          byId: Object.fromEntries(this.index.byId.entries()),
          bySubject: Object.fromEntries(Array.from(this.index.bySubject.entries()).map(
            ([k, v]) => [k, Array.from(v)]
          )),
          byIssuer: Object.fromEntries(Array.from(this.index.byIssuer.entries()).map(
            ([k, v]) => [k, Array.from(v)]
          )),
          byType: Object.fromEntries(Array.from(this.index.byType.entries()).map(
            ([k, v]) => [k, Array.from(v)]
          )),
          byInscription: Object.fromEntries(Array.from(this.index.byInscription.entries()).map(
            ([k, v]) => [k, Array.from(v)]
          ))
        },
        config: {
          enableEncryption: this.config.enableEncryption
        },
        backupDate: new Date().toISOString()
      };
      
      // Serialize and save
      const serializedData = JSON.stringify(backupData, null, 2);
      
      // Ensure directory exists
      const directory = path.dirname(backupPath);
      await fs.mkdir(directory, { recursive: true });
      
      await fs.writeFile(backupPath, serializedData, 'utf8');
      return true;
    } catch (error) {
      console.error(`Error creating backup at ${backupPath}:`, error);
      return false;
    }
  }

  /**
   * Restore from a backup
   * 
   * @param backupPath - Path to the backup file
   * @returns Whether the restore was successful
   */
  async restoreFromBackup(backupPath: string): Promise<boolean> {
    try {
      // Read and parse backup file
      const serializedData = await fs.readFile(backupPath, 'utf8');
      const backupData = JSON.parse(serializedData);
      
      // Validate backup data
      if (!backupData.credentials || !backupData.metadata || !backupData.index) {
        throw new Error('Invalid backup file format');
      }
      
      // Check if encryption settings match
      if (backupData.config.enableEncryption !== this.config.enableEncryption) {
        throw new Error(
          'Encryption setting mismatch between backup and current configuration'
        );
      }
      
      // Clear current data
      this.credentials.clear();
      this.metadata.clear();
      this.index.byId.clear();
      this.index.bySubject.clear();
      this.index.byIssuer.clear();
      this.index.byType.clear();
      this.index.byInscription.clear();
      
      // Restore credentials and metadata
      for (const [key, value] of Object.entries(backupData.credentials)) {
        this.credentials.set(key, value as string);
      }
      
      for (const [key, value] of Object.entries(backupData.metadata)) {
        this.metadata.set(key, value as CredentialMetadata);
      }
      
      // Restore indexes
      for (const [key, value] of Object.entries(backupData.index.byId)) {
        this.index.byId.set(key, value as string);
      }
      
      for (const [key, values] of Object.entries(backupData.index.bySubject)) {
        this.index.bySubject.set(key, new Set(values as string[]));
      }
      
      for (const [key, values] of Object.entries(backupData.index.byIssuer)) {
        this.index.byIssuer.set(key, new Set(values as string[]));
      }
      
      for (const [key, values] of Object.entries(backupData.index.byType)) {
        this.index.byType.set(key, new Set(values as string[]));
      }
      
      for (const [key, values] of Object.entries(backupData.index.byInscription)) {
        this.index.byInscription.set(key, new Set(values as string[]));
      }
      
      return true;
    } catch (error) {
      console.error(`Error restoring from backup at ${backupPath}:`, error);
      return false;
    }
  }

  /**
   * Get statistics about the credential store
   * 
   * @returns Statistics about the store
   */
  async getStats(): Promise<CredentialStoreStats> {
    return {
      totalCredentials: this.credentials.size,
      uniqueSubjects: this.index.bySubject.size,
      uniqueIssuers: this.index.byIssuer.size,
      uniqueTypes: this.index.byType.size,
      encryptionEnabled: this.config.enableEncryption || false
    };
  }

  /**
   * Generate a unique ID for a credential if it doesn't have one
   * 
   * @param credential - The credential
   * @returns A generated ID
   */
  private generateCredentialId(credential: VerifiableCredential): string {
    // Use existing ID if present
    if (credential.id) {
      return credential.id;
    }
    
    // Generate a consistent ID based on credential properties
    const issuerId = credential.issuer.id;
    const subjectId = typeof credential.credentialSubject === 'object' && 
      !Array.isArray(credential.credentialSubject) && 
      credential.credentialSubject.id ? 
      credential.credentialSubject.id : 'unknown';
    const issuanceDate = credential.issuanceDate;
    const types = Array.isArray(credential.type) ? 
      credential.type.join(',') : credential.type;
    
    // Create a hash of these properties
    const idSource = `${issuerId}:${subjectId}:${issuanceDate}:${types}:${Date.now()}`;
    const hash = crypto.createHash('sha256').update(idSource).digest('hex');
    
    return `urn:vc:${hash.substring(0, 16)}`;
  }

  /**
   * Generate a storage key for a credential
   * 
   * @returns A unique storage key
   */
  private generateStorageKey(): string {
    return crypto.randomUUID();
  }

  /**
   * Encrypt data using AES-256-GCM
   * 
   * @param data - Data to encrypt
   * @param key - Encryption key
   * @returns Encrypted data
   */
  private encryptData(data: string, key: string): string {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher using AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), iv);
    
    // Encrypt the data
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get the authentication tag
    const authTag = cipher.getAuthTag();
    
    // Return IV, encrypted data, and auth tag as a single string
    return `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}`;
  }

  /**
   * Decrypt data using AES-256-GCM
   * 
   * @param encryptedData - Data to decrypt
   * @param key - Encryption key
   * @returns Decrypted data
   */
  private decryptData(encryptedData: string, key: string): string {
    // Split the encrypted data into IV, ciphertext, and auth tag
    const [ivBase64, ciphertext, authTagBase64] = encryptedData.split(':');
    
    // Decode IV and auth tag
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key), iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt the data
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Add a credential to the indexes
   * 
   * @param id - Credential ID
   * @param credential - The credential
   * @param storageKey - Storage key for the credential
   * @param metadata - Credential metadata
   */
  private indexCredential(
    id: string,
    credential: VerifiableCredential,
    storageKey: string,
    metadata: CredentialMetadata
  ): void {
    // Index by ID
    this.index.byId.set(id, storageKey);
    
    // Index by subject
    if (typeof credential.credentialSubject === 'object' && 
        !Array.isArray(credential.credentialSubject) && 
        credential.credentialSubject.id) {
      const subjectId = credential.credentialSubject.id;
      if (!this.index.bySubject.has(subjectId)) {
        this.index.bySubject.set(subjectId, new Set());
      }
      this.index.bySubject.get(subjectId)?.add(id);
    }
    
    // Index by issuer
    const issuerId = credential.issuer.id;
    if (!this.index.byIssuer.has(issuerId)) {
      this.index.byIssuer.set(issuerId, new Set());
    }
    this.index.byIssuer.get(issuerId)?.add(id);
    
    // Index by type(s)
    const types = Array.isArray(credential.type) ? credential.type : [credential.type];
    for (const type of types) {
      if (!this.index.byType.has(type)) {
        this.index.byType.set(type, new Set());
      }
      this.index.byType.get(type)?.add(id);
    }
    
    // Index by inscription if present
    if (metadata.inscriptionId) {
      const inscriptionId = metadata.inscriptionId;
      if (!this.index.byInscription.has(inscriptionId)) {
        this.index.byInscription.set(inscriptionId, new Set());
      }
      this.index.byInscription.get(inscriptionId)?.add(id);
    }
  }

  /**
   * Remove a credential from indexes
   * 
   * @param id - Credential ID
   * @param credential - The credential
   * @param metadata - Credential metadata
   */
  private removeCredentialFromIndexes(
    id: string,
    credential: VerifiableCredential,
    metadata: CredentialMetadata
  ): void {
    // Remove from subject index
    if (typeof credential.credentialSubject === 'object' && 
        !Array.isArray(credential.credentialSubject) && 
        credential.credentialSubject.id) {
      const subjectId = credential.credentialSubject.id;
      this.index.bySubject.get(subjectId)?.delete(id);
      if (this.index.bySubject.get(subjectId)?.size === 0) {
        this.index.bySubject.delete(subjectId);
      }
    }
    
    // Remove from issuer index
    const issuerId = credential.issuer.id;
    this.index.byIssuer.get(issuerId)?.delete(id);
    if (this.index.byIssuer.get(issuerId)?.size === 0) {
      this.index.byIssuer.delete(issuerId);
    }
    
    // Remove from type index
    const types = Array.isArray(credential.type) ? credential.type : [credential.type];
    for (const type of types) {
      this.index.byType.get(type)?.delete(id);
      if (this.index.byType.get(type)?.size === 0) {
        this.index.byType.delete(type);
      }
    }
    
    // Remove from inscription index if present
    if (metadata.inscriptionId) {
      const inscriptionId = metadata.inscriptionId;
      this.index.byInscription.get(inscriptionId)?.delete(id);
      if (this.index.byInscription.get(inscriptionId)?.size === 0) {
        this.index.byInscription.delete(inscriptionId);
      }
    }
  }

  /**
   * Clean up any resources, such as auto-save timer
   */
  public dispose(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
  }
} 