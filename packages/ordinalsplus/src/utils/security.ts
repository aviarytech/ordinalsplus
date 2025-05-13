import crypto from 'crypto';
import { DidDocument } from '../types/did';
import { AuditSeverity, logSecurityEvent } from './audit-logger';

/**
 * Options for tamper protection
 */
export interface TamperProtectionOptions {
  signatureType?: 'Ed25519' | 'secp256k1' | 'schnorr';
  hashAlgorithm?: 'sha256' | 'sha512';
  includeTimestamp?: boolean;
}

/**
 * Interface for tamper protection metadata
 */
export interface TamperProtectionMetadata {
  hash: string;
  signature?: string;
  keyId?: string;
  timestamp?: string;
  algorithm: string;
}

/**
 * Create a hash of a DID document for integrity checks
 * 
 * @param document - The DID document to hash
 * @param options - Options for hashing
 * @returns The hash of the document as a hex string
 */
export function hashDidDocument(
  document: DidDocument, 
  options: { algorithm?: 'sha256' | 'sha512' } = {}
): string {
  const algorithm = options.algorithm || 'sha256';
  const hash = crypto.createHash(algorithm);
  
  // Create a stable JSON representation by sorting keys
  const stableJson = JSON.stringify(canonicalizeDocument(document));
  
  // Update hash with document content
  hash.update(stableJson);
  
  // Return the hash as a hex string
  return hash.digest('hex');
}

/**
 * Create a canonicalized version of a DID document for consistent hashing
 * This sorts all objects by keys to ensure consistent serialization
 * 
 * @param obj - The object to canonicalize
 * @returns A new object with sorted keys
 */
export function canonicalizeDocument(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(canonicalizeDocument);
  }
  
  // Get all keys and sort them
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, any> = {};
  
  // Create new object with sorted keys
  for (const key of sortedKeys) {
    // Skip the tamperProtection field if it exists
    if (key === 'tamperProtection') continue;
    result[key] = canonicalizeDocument(obj[key]);
  }
  
  return result;
}

/**
 * Add tamper protection to a DID document
 * 
 * @param document - The DID document to protect
 * @param keyManager - Optional key manager for signing
 * @param keyId - Optional key ID to use for signing
 * @param options - Options for tamper protection
 * @returns A new DID document with tamper protection metadata
 */
export async function addTamperProtection(
  document: DidDocument,
  keyManager?: any,
  keyId?: string,
  options: TamperProtectionOptions = {}
): Promise<DidDocument> {
  // Create a copy of the document to avoid mutating the original
  const protectedDocument = { ...document };
  
  // Remove any existing tamper protection
  if ('tamperProtection' in protectedDocument) {
    delete (protectedDocument as any).tamperProtection;
  }
  
  // Create the hash
  const hashAlgorithm = options.hashAlgorithm || 'sha256';
  const documentHash = hashDidDocument(protectedDocument, { algorithm: hashAlgorithm });
  
  // Create tamper protection metadata
  const tamperProtection: TamperProtectionMetadata = {
    hash: documentHash,
    algorithm: hashAlgorithm
  };
  
  // Add timestamp if requested
  if (options.includeTimestamp) {
    tamperProtection.timestamp = new Date().toISOString();
  }
  
  // Add signature if key manager and key ID are provided
  if (keyManager && keyId) {
    // Convert hash to Uint8Array for signing
    const hashBytes = Buffer.from(documentHash, 'hex');
    
    // Sign the hash
    try {
      const signature = await keyManager.sign(keyId, hashBytes);
      tamperProtection.signature = Buffer.from(signature).toString('base64');
      tamperProtection.keyId = keyId;
    } catch (error) {
      console.error('Failed to sign document:', error);
      // Log the security event
      await logSecurityEvent(
        'tamper_protection_signing_failed',
        AuditSeverity.ERROR,
        document.id,
        undefined,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  // Add tamper protection to the document
  return { 
    ...protectedDocument,
    tamperProtection
  } as DidDocument;
}

/**
 * Verify tamper protection on a DID document
 * 
 * @param document - The DID document to verify
 * @param keyManager - Optional key manager for signature verification
 * @returns An object with verification result and any error messages
 */
export async function verifyTamperProtection(
  document: DidDocument,
  keyManager?: any
): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  // Check if document has tamper protection
  if (!document || !('tamperProtection' in document)) {
    errors.push('Document does not have tamper protection');
    return { isValid: false, errors };
  }
  
  const tamperProtection = (document as any).tamperProtection as TamperProtectionMetadata;
  
  // Create a copy of the document without tamper protection for hashing
  const documentWithoutProtection = { ...document };
  delete (documentWithoutProtection as any).tamperProtection;
  
  // Calculate the hash and compare
  const calculatedHash = hashDidDocument(documentWithoutProtection, { 
    algorithm: tamperProtection.algorithm as 'sha256' | 'sha512' 
  });
  
  if (calculatedHash !== tamperProtection.hash) {
    errors.push('Document hash does not match, possible tampering detected');
    
    // Log the security event
    await logSecurityEvent(
      'tamper_detection',
      AuditSeverity.WARNING,
      document.id,
      undefined,
      { 
        expectedHash: tamperProtection.hash,
        calculatedHash 
      }
    );
    
    return { isValid: false, errors };
  }
  
  // Verify signature if present and key manager is provided
  if (tamperProtection.signature && tamperProtection.keyId && keyManager) {
    try {
      const hashBytes = Buffer.from(tamperProtection.hash, 'hex');
      const signatureBytes = Buffer.from(tamperProtection.signature, 'base64');
      
      const isSignatureValid = await keyManager.verify(
        tamperProtection.keyId,
        hashBytes,
        signatureBytes
      );
      
      if (!isSignatureValid) {
        errors.push('Invalid signature, possible tampering detected');
        
        // Log the security event
        await logSecurityEvent(
          'invalid_signature',
          AuditSeverity.ERROR,
          document.id,
          undefined,
          { keyId: tamperProtection.keyId }
        );
        
        return { isValid: false, errors };
      }
    } catch (error) {
      errors.push(`Signature verification failed: ${error instanceof Error ? error.message : String(error)}`);
      
      // Log the security event
      await logSecurityEvent(
        'signature_verification_failed',
        AuditSeverity.ERROR,
        document.id,
        undefined,
        { error: error instanceof Error ? error.message : String(error) }
      );
      
      return { isValid: false, errors };
    }
  }
  
  return { isValid: true, errors: [] };
}

/**
 * Interface for common security attack detection results
 */
export interface SecurityCheckResult {
  type: string;
  severity: AuditSeverity;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Check a DID document for common security vulnerabilities or attacks
 * 
 * @param document - The DID document to check
 * @returns Array of detected security issues
 */
export async function checkDidDocumentSecurity(
  document: DidDocument
): Promise<SecurityCheckResult[]> {
  const results: SecurityCheckResult[] = [];
  
  // Check for missing required verification method properties
  if (document.verificationMethod) {
    for (const [index, vm] of document.verificationMethod.entries()) {
      if (!vm.id || !vm.type || !vm.controller || !vm.publicKeyMultibase) {
        results.push({
          type: 'incomplete_verification_method',
          severity: AuditSeverity.WARNING,
          message: `Verification method at index ${index} is missing required properties`,
          details: { index, verificationMethod: vm }
        });
        
        // Log the security event
        await logSecurityEvent(
          'incomplete_verification_method',
          AuditSeverity.WARNING,
          document.id,
          undefined,
          { index, verificationMethod: vm }
        );
      }
    }
  }
  
  // Check for potentially malicious references in authentication
  if (document.authentication) {
    for (const [index, auth] of document.authentication.entries()) {
      if (typeof auth === 'string' && !auth.startsWith(document.id)) {
        results.push({
          type: 'external_authentication_reference',
          severity: AuditSeverity.WARNING,
          message: `Authentication at index ${index} references an external DID`,
          details: { index, reference: auth }
        });
        
        // Log the security event
        await logSecurityEvent(
          'external_authentication_reference',
          AuditSeverity.WARNING,
          document.id,
          undefined,
          { index, reference: auth }
        );
      }
    }
  }
  
  // Check for revoked verification methods still being used in authentication
  if (document.verificationMethod && document.authentication) {
    const revokedMethods = document.verificationMethod
      .filter(vm => vm.revoked)
      .map(vm => vm.id);
    
    if (revokedMethods.length > 0) {
      for (const [index, auth] of document.authentication.entries()) {
        const authId = typeof auth === 'string' ? auth : auth.id;
        if (revokedMethods.includes(authId)) {
          results.push({
            type: 'revoked_key_in_use',
            severity: AuditSeverity.ERROR,
            message: `Authentication at index ${index} references a revoked verification method`,
            details: { index, reference: authId }
          });
          
          // Log the security event
          await logSecurityEvent(
            'revoked_key_in_use',
            AuditSeverity.ERROR,
            document.id,
            undefined,
            { index, reference: authId }
          );
        }
      }
    }
  }
  
  // Check for excessive number of verification methods (potential DoS vector)
  if (document.verificationMethod && document.verificationMethod.length > 50) {
    results.push({
      type: 'excessive_verification_methods',
      severity: AuditSeverity.WARNING,
      message: `Document has an unusually high number of verification methods (${document.verificationMethod.length})`,
      details: { count: document.verificationMethod.length }
    });
    
    // Log the security event
    await logSecurityEvent(
      'excessive_verification_methods',
      AuditSeverity.WARNING,
      document.id,
      undefined,
      { count: document.verificationMethod.length }
    );
  }
  
  return results;
}

/**
 * Rate limit tracking for DID operations
 */
const rateLimits = new Map<string, { count: number, timestamp: number }>();

/**
 * Check and enforce rate limits for DID operations
 * 
 * @param actorId - Identifier for the actor (e.g., IP address, user ID)
 * @param operation - The operation being performed
 * @param maxRequests - Maximum number of requests in the time window
 * @param timeWindowMs - Time window in milliseconds
 * @returns True if the operation is allowed, false if rate limited
 */
export async function checkRateLimit(
  actorId: string,
  operation: string,
  maxRequests: number = 100,
  timeWindowMs: number = 60000 // 1 minute default
): Promise<boolean> {
  const key = `${actorId}:${operation}`;
  const now = Date.now();
  
  // Get current rate limit info or create new entry
  let limitInfo = rateLimits.get(key);
  if (!limitInfo) {
    limitInfo = { count: 0, timestamp: now };
    rateLimits.set(key, limitInfo);
  }
  
  // Reset counter if time window has passed
  if (now - limitInfo.timestamp > timeWindowMs) {
    limitInfo.count = 0;
    limitInfo.timestamp = now;
  }
  
  // Increment counter
  limitInfo.count++;
  
  // Check if rate limited
  if (limitInfo.count > maxRequests) {
    // Log the security event
    await logSecurityEvent(
      'rate_limit_exceeded',
      AuditSeverity.WARNING,
      operation,
      actorId,
      { count: limitInfo.count, maxRequests, timeWindowMs }
    );
    
    return false;
  }
  
  return true;
}

/**
 * Clean up expired rate limits to prevent memory leaks
 */
export function cleanupRateLimits(timeWindowMs: number = 60000): void {
  const now = Date.now();
  
  // Remove entries older than the time window
  for (const [key, limitInfo] of rateLimits.entries()) {
    if (now - limitInfo.timestamp > timeWindowMs) {
      rateLimits.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(() => cleanupRateLimits(), 5 * 60 * 1000); 