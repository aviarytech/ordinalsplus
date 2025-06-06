/**
 * Verifiable Credential Validators
 * 
 * This module provides validators for verifying that Verifiable Credentials
 * conform to the W3C VC Data Model 2.0 specification and Aces API requirements.
 * 
 * @see https://www.w3.org/TR/vc-data-model-2.0/
 */

import { VerifiableCredential, CredentialSubject, CredentialProof, ContentInfo } from './types';
import { VC_CONTEXTS, VC_TYPES } from './formatters';

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Error message if validation failed */
  errors?: string[];
}

/**
 * Creates a successful validation result
 * 
 * @returns Successful validation result
 */
export function validResult(): ValidationResult {
  return { valid: true };
}

/**
 * Creates a failed validation result
 * 
 * @param errors - Error messages
 * @returns Failed validation result
 */
export function invalidResult(errors: string[]): ValidationResult {
  return { valid: false, errors };
}

/**
 * Validates credential context
 * 
 * @param context - The credential context to validate
 * @returns Validation result
 */
export function validateContext(context: any): ValidationResult {
  const errors: string[] = [];
  
  // Context must be defined
  if (!context) {
    errors.push('Credential context is required');
    return invalidResult(errors);
  }
  
  // Context can be a string, object, or array
  if (typeof context === 'string') {
    // Single string context is valid
  } else if (Array.isArray(context)) {
    // Must have at least the core context
    const hasCore = context.some(ctx => 
      typeof ctx === 'string' && ctx === VC_CONTEXTS.CORE_V2
    );
    
    if (!hasCore) {
      errors.push(`Credential context array must include the core context: ${VC_CONTEXTS.CORE_V2}`);
    }
  } else if (typeof context === 'object') {
    // Object context is valid but unusual, should have @context property
    if (!context['@context']) {
      errors.push('Object credential context should have @context property');
    }
  } else {
    errors.push('Credential context must be a string, object, or array');
  }
  
  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates credential type
 * 
 * @param type - The credential type to validate
 * @returns Validation result
 */
export function validateType(type: any): ValidationResult {
  const errors: string[] = [];
  
  // Type must be defined
  if (!type) {
    errors.push('Credential type is required');
    return invalidResult(errors);
  }
  
  // Type can be a string or array of strings
  if (typeof type === 'string') {
    // Single string type is valid, but should be VerifiableCredential
    if (type !== VC_TYPES.VERIFIABLE_CREDENTIAL) {
      errors.push(`Credential should have type ${VC_TYPES.VERIFIABLE_CREDENTIAL}`);
    }
  } else if (Array.isArray(type)) {
    // Must have at least VerifiableCredential
    const hasCore = type.includes(VC_TYPES.VERIFIABLE_CREDENTIAL);
    
    if (!hasCore) {
      errors.push(`Credential type array must include ${VC_TYPES.VERIFIABLE_CREDENTIAL}`);
    }
    
    // All types must be strings
    const nonStringTypes = type.filter(t => typeof t !== 'string');
    if (nonStringTypes.length > 0) {
      errors.push('All credential types must be strings');
    }
  } else {
    errors.push('Credential type must be a string or array of strings');
  }
  
  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates credential issuer
 * 
 * @param issuer - The credential issuer to validate
 * @returns Validation result
 */
export function validateIssuer(issuer: any): ValidationResult {
  const errors: string[] = [];
  
  // Issuer must be defined
  if (!issuer) {
    errors.push('Credential issuer is required');
    return invalidResult(errors);
  }
  
  // Issuer can be a string or object with id
  if (typeof issuer === 'string') {
    // Valid if it's a non-empty string (preferably a DID)
    if (issuer.trim() === '') {
      errors.push('Issuer string cannot be empty');
    }
  } else if (typeof issuer === 'object') {
    // Must have id property
    if (!issuer.id) {
      errors.push('Issuer object must have an id property');
    } else if (typeof issuer.id !== 'string' || issuer.id.trim() === '') {
      errors.push('Issuer id must be a non-empty string');
    }
  } else {
    errors.push('Issuer must be a string or object with id property');
  }
  
  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates credential subject
 * 
 * @param subject - The credential subject to validate
 * @returns Validation result
 */
export function validateSubject(subject: any): ValidationResult {
  const errors: string[] = [];
  
  // Subject must be defined
  if (!subject) {
    errors.push('Credential subject is required');
    return invalidResult(errors);
  }
  
  // Subject can be an object or array of objects
  if (Array.isArray(subject)) {
    // Check each subject in the array
    for (let i = 0; i < subject.length; i++) {
      const item = subject[i];
      
      if (!item || typeof item !== 'object') {
        errors.push(`Subject at index ${i} must be an object`);
        continue;
      }
      
      // Each subject should have an id
      if (!item.id) {
        errors.push(`Subject at index ${i} should have an id property`);
      }
    }
  } else if (typeof subject === 'object') {
    // Subject should have an id
    if (!subject.id) {
      errors.push('Subject should have an id property');
    }
  } else {
    errors.push('Subject must be an object or array of objects');
  }
  
  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates a date string
 * 
 * @param date - The date string to validate
 * @param fieldName - Name of the field being validated
 * @returns Validation result
 */
export function validateDate(date: any, fieldName: string): ValidationResult {
  const errors: string[] = [];
  
  // Date must be a string
  if (typeof date !== 'string') {
    errors.push(`${fieldName} must be a string`);
    return invalidResult(errors);
  }
  
  // Check if it's a valid ISO date
  const timestamp = Date.parse(date);
  if (isNaN(timestamp)) {
    errors.push(`${fieldName} must be a valid ISO date string`);
  }
  
  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates credential proof
 * 
 * @param proof - The credential proof to validate
 * @returns Validation result
 */
export function validateProof(proof: any): ValidationResult {
  const errors: string[] = [];
  
  // Proof is optional for unsigned credentials
  if (!proof) {
    return validResult();
  }
  
  // Proof can be an object or array of objects
  if (Array.isArray(proof)) {
    // Check each proof in the array
    for (let i = 0; i < proof.length; i++) {
      const item = proof[i];
      
      if (!item || typeof item !== 'object') {
        errors.push(`Proof at index ${i} must be an object`);
        continue;
      }
      
      // Validate required proof properties
      const requiredProps = ['type', 'created', 'verificationMethod'];
      for (const prop of requiredProps) {
        if (!item[prop]) {
          errors.push(`Proof at index ${i} is missing required property: ${prop}`);
        }
      }
    }
  } else if (typeof proof === 'object') {
    // Validate required proof properties
    const requiredProps = ['type', 'created', 'verificationMethod'];
    for (const prop of requiredProps) {
      if (!proof[prop]) {
        errors.push(`Proof is missing required property: ${prop}`);
      }
    }
    
    // Validate created date if present
    if (proof.created) {
      const dateResult = validateDate(proof.created, 'Proof created');
      if (!dateResult.valid && dateResult.errors) {
        errors.push(...dateResult.errors);
      }
    }
  } else {
    errors.push('Proof must be an object or array of objects');
  }
  
  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates contentInfo object
 * 
 * @param contentInfo - The content info to validate
 * @returns Validation result
 */
export function validateContentInfo(contentInfo: any): ValidationResult {
  const errors: string[] = [];
  
  // ContentInfo must be defined
  if (!contentInfo) {
    errors.push('ContentInfo is required');
    return invalidResult(errors);
  }
  
  // Must have required properties
  if (!contentInfo.mimeType) {
    errors.push('ContentInfo must have a mimeType property');
  }
  
  if (!contentInfo.hash) {
    errors.push('ContentInfo must have a hash property');
  }
  
  // Validate dimensions if present
  if (contentInfo.dimensions) {
    if (typeof contentInfo.dimensions !== 'object') {
      errors.push('ContentInfo dimensions must be an object');
    } else {
      if (typeof contentInfo.dimensions.width !== 'number') {
        errors.push('ContentInfo dimensions.width must be a number');
      }
      if (typeof contentInfo.dimensions.height !== 'number') {
        errors.push('ContentInfo dimensions.height must be a number');
      }
    }
  }
  
  // Validate size if present
  if (contentInfo.size !== undefined && typeof contentInfo.size !== 'number') {
    errors.push('ContentInfo size must be a number');
  }
  
  // Validate duration if present
  if (contentInfo.duration !== undefined && typeof contentInfo.duration !== 'number') {
    errors.push('ContentInfo duration must be a number');
  }
  
  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates an entire credential
 * 
 * @param credential - The credential to validate
 * @returns Validation result
 */
export function validateCredential(credential: any): ValidationResult {
  const errors: string[] = [];
  
  // Credential must be defined
  if (!credential) {
    errors.push('Credential is required');
    return invalidResult(errors);
  }
  
  // Validate @context
  const contextResult = validateContext(credential['@context']);
  if (!contextResult.valid && contextResult.errors) {
    errors.push(...contextResult.errors);
  }
  
  // Validate type
  const typeResult = validateType(credential.type);
  if (!typeResult.valid && typeResult.errors) {
    errors.push(...typeResult.errors);
  }
  
  // Validate issuer
  const issuerResult = validateIssuer(credential.issuer);
  if (!issuerResult.valid && issuerResult.errors) {
    errors.push(...issuerResult.errors);
  }
  
  // Validate credentialSubject
  const subjectResult = validateSubject(credential.credentialSubject);
  if (!subjectResult.valid && subjectResult.errors) {
    errors.push(...subjectResult.errors);
  }
  
  // Validate proof if present
  if (credential.proof) {
    const proofResult = validateProof(credential.proof);
    if (!proofResult.valid && proofResult.errors) {
      errors.push(...proofResult.errors);
    }
  }
  
  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates parameters for VC issuance
 * 
 * @param params - The issuance parameters to validate
 * @returns Validation result
 */
export function validateIssuanceParams(params: any): ValidationResult {
  const errors: string[] = [];
  
  // Params must be defined
  if (!params) {
    errors.push('Issuance parameters are required');
    return invalidResult(errors);
  }
  
  // Validate required fields
  if (!params.subjectDid) {
    errors.push('Issuance parameters must include subjectDid');
  }
  
  if (!params.issuerDid) {
    errors.push('Issuance parameters must include issuerDid');
  }
  
  if (!params.metadata) {
    errors.push('Issuance parameters must include metadata');
  }
  
  if (!params.contentInfo) {
    errors.push('Issuance parameters must include contentInfo');
  } else {
    // Validate contentInfo
    const contentInfoResult = validateContentInfo(params.contentInfo);
    if (!contentInfoResult.valid && contentInfoResult.errors) {
      errors.push(...contentInfoResult.errors);
    }
  }
  
  return errors.length > 0 ? invalidResult(errors) : validResult();
} 