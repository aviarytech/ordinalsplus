/**
 * Validation utilities for the ResourceInscriptionWizard component.
 * Provides validation rules and functions for all form fields in the wizard.
 */

// Type definitions for validation
export interface ValidationError {
  field: string;
  message: string;
}

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

// Constants for validation rules
export const VALIDATION_RULES = {
  TITLE: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 100,
  },
  DESCRIPTION: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 500,
  },
  CONTENT: {
    MAX_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  },
  FILE: {
    MAX_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  },
  METADATA: {
    MAX_JSON_SIZE: 100 * 1024, // 100KB
  },
};

/**
 * Validates a required field
 * @param value The value to validate
 * @param fieldName The name of the field
 * @param displayName The display name of the field
 * @returns ValidationResult
 */
export const validateRequired = (
  value: string | null | undefined,
  fieldName: string,
  displayName: string
): ValidationResult => {
  const errors: ValidationError[] = [];
  
  if (!value || value.trim() === '') {
    errors.push({
      field: fieldName,
      message: `${displayName} is required`,
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validates a string field with length constraints
 * @param value The value to validate
 * @param fieldName The name of the field
 * @param displayName The display name of the field
 * @param minLength The minimum length
 * @param maxLength The maximum length
 * @param required Whether the field is required
 * @returns ValidationResult
 */
export const validateStringLength = (
  value: string | null | undefined,
  fieldName: string,
  displayName: string,
  minLength: number,
  maxLength: number,
  required = true
): ValidationResult => {
  const errors: ValidationError[] = [];
  
  // Check if required
  if (required && (!value || value.trim() === '')) {
    errors.push({
      field: fieldName,
      message: `${displayName} is required`,
    });
    
    return {
      valid: false,
      errors,
    };
  }
  
  // Skip further validation if not required and empty
  if (!required && (!value || value.trim() === '')) {
    return {
      valid: true,
      errors: [],
    };
  }
  
  // Check min length
  if (value && value.trim().length < minLength) {
    errors.push({
      field: fieldName,
      message: `${displayName} must be at least ${minLength} characters`,
    });
  }
  
  // Check max length
  if (value && value.trim().length > maxLength) {
    errors.push({
      field: fieldName,
      message: `${displayName} cannot exceed ${maxLength} characters`,
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validates a JSON string
 * @param value The JSON string to validate
 * @param fieldName The name of the field
 * @param displayName The display name of the field
 * @param required Whether the field is required
 * @returns ValidationResult
 */
export const validateJson = (
  value: string | null | undefined,
  fieldName: string,
  displayName: string,
  required = false
): ValidationResult => {
  const errors: ValidationError[] = [];
  
  // Check if required
  if (required && (!value || value.trim() === '')) {
    errors.push({
      field: fieldName,
      message: `${displayName} is required`,
    });
    
    return {
      valid: false,
      errors,
    };
  }
  
  // Skip further validation if not required and empty
  if (!required && (!value || value.trim() === '')) {
    return {
      valid: true,
      errors: [],
    };
  }
  
  // Check if valid JSON
  if (value && value.trim() !== '') {
    try {
      JSON.parse(value);
    } catch (e) {
      errors.push({
        field: fieldName,
        message: `${displayName} must be valid JSON`,
      });
    }
  }
  
  // Check size
  if (value && value.length > VALIDATION_RULES.METADATA.MAX_JSON_SIZE) {
    errors.push({
      field: fieldName,
      message: `${displayName} is too large (max ${VALIDATION_RULES.METADATA.MAX_JSON_SIZE / 1024}KB)`,
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validates a file
 * @param file The file to validate
 * @param fieldName The name of the field
 * @param displayName The display name of the field
 * @param allowedTypes Array of allowed MIME types
 * @param maxSize Maximum file size in bytes
 * @param required Whether the field is required
 * @returns ValidationResult
 */
export const validateFile = (
  file: File | null | undefined,
  fieldName: string,
  displayName: string,
  allowedTypes: string[],
  maxSize = VALIDATION_RULES.FILE.MAX_SIZE_BYTES,
  required = false
): ValidationResult => {
  const errors: ValidationError[] = [];
  
  // Check if required
  if (required && !file) {
    errors.push({
      field: fieldName,
      message: `${displayName} is required`,
    });
    
    return {
      valid: false,
      errors,
    };
  }
  
  // Skip further validation if not required and no file
  if (!required && !file) {
    return {
      valid: true,
      errors: [],
    };
  }
  
  // Check file type
  if (file && allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    errors.push({
      field: fieldName,
      message: `${displayName} must be one of the following types: ${allowedTypes.join(', ')}`,
    });
  }
  
  // Check file size
  if (file && file.size > maxSize) {
    errors.push({
      field: fieldName,
      message: `${displayName} is too large (max ${maxSize / (1024 * 1024)}MB)`,
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validates content based on its type
 * @param content The content to validate
 * @param contentType The content type
 * @param fieldName The name of the field
 * @param displayName The display name of the field
 * @returns ValidationResult
 */
export const validateContent = (
  content: string | null | undefined,
  contentType: string | null | undefined,
  fieldName: string,
  displayName: string
): ValidationResult => {
  const errors: ValidationError[] = [];
  
  // Check if content is required
  if (!content || content.trim() === '') {
    errors.push({
      field: fieldName,
      message: `${displayName} is required`,
    });
    
    return {
      valid: false,
      errors,
    };
  }
  
  // Check content size
  if (content && new Blob([content]).size > VALIDATION_RULES.CONTENT.MAX_SIZE_BYTES) {
    errors.push({
      field: fieldName,
      message: `${displayName} is too large (max ${VALIDATION_RULES.CONTENT.MAX_SIZE_BYTES / (1024 * 1024)}MB)`,
    });
  }
  
  // Validate JSON content
  if (contentType === 'application/json') {
    try {
      JSON.parse(content);
    } catch (e) {
      errors.push({
        field: fieldName,
        message: `${displayName} must be valid JSON`,
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validates UTXO selection
 * @param utxos Array of selected UTXOs
 * @param fieldName The name of the field
 * @param displayName The display name of the field
 * @param minCount Minimum number of UTXOs required
 * @returns ValidationResult
 */
export const validateUtxoSelection = (
  utxos: any[],
  fieldName: string,
  displayName: string,
  minCount = 1
): ValidationResult => {
  const errors: ValidationError[] = [];
  
  // Check if minimum number of UTXOs are selected
  if (!utxos || utxos.length < minCount) {
    errors.push({
      field: fieldName,
      message: `At least ${minCount} ${displayName} must be selected`,
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Formats validation errors into a record for easier access
 * @param errors Array of validation errors
 * @returns Record of field names to error messages
 */
export const formatValidationErrors = (errors: ValidationError[]): Record<string, string> => {
  return errors.reduce((acc, error) => {
    acc[error.field] = error.message;
    return acc;
  }, {} as Record<string, string>);
};

/**
 * Validates the entire form for a specific step
 * @param step The current step
 * @param formData The form data
 * @returns ValidationResult
 */
export const validateStep = (
  step: string,
  formData: any
): ValidationResult => {
  const errors: ValidationError[] = [];
  
  switch (step) {
    case 'utxo':
      // Validate UTXO selection - check the new inscriptionUtxo field
      if (!formData.inscriptionUtxo) {
        errors.push({
          field: 'utxoSelection',
          message: 'Please select a UTXO for inscription'
        });
      }
      break;
      
    case 'content':
      // Validate content type - check both null/undefined and empty string
      if (!formData.contentData.type || formData.contentData.type.trim() === '') {
        errors.push({
          field: 'contentType',
          message: 'Content type is required',
        });
      } else {
        // Content type is valid, now validate the content
        const contentResult = validateContent(
          formData.contentData.content,
          formData.contentData.type,
          'content',
          'Content'
        );
        errors.push(...contentResult.errors);
      }
      break;
      
    case 'metadata':
      // Only validate VC provider if isVerifiableCredential is true
      if (formData.metadata.isVerifiableCredential && !formData.metadata.verifiableCredential.provider) {
        errors.push({
          field: 'vcProvider',
          message: 'VC Provider is required when Verifiable Credential is enabled',
        });
      }
      break;
      
    default:
      break;
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validates a single field and returns the error message if invalid
 * @param field The field name
 * @param value The field value
 * @param formData Additional form data for context
 * @returns Error message or null if valid
 */
export const validateField = (
  field: string,
  value: any,
  formData?: any
): string | null => {
  switch (field) {
    case 'title':
      const titleResult = validateStringLength(
        value,
        'title',
        'Title',
        VALIDATION_RULES.TITLE.MIN_LENGTH,
        VALIDATION_RULES.TITLE.MAX_LENGTH
      );
      return titleResult.valid ? null : titleResult.errors[0].message;
      
    case 'description':
      const descriptionResult = validateStringLength(
        value,
        'description',
        'Description',
        VALIDATION_RULES.DESCRIPTION.MIN_LENGTH,
        VALIDATION_RULES.DESCRIPTION.MAX_LENGTH
      );
      return descriptionResult.valid ? null : descriptionResult.errors[0].message;
      
    case 'content':
      const contentType = formData?.contentData?.type || 'text/plain';
      const contentResult = validateContent(
        value,
        contentType,
        'content',
        'Content'
      );
      return contentResult.valid ? null : contentResult.errors[0].message;
      
    case 'rawMetadata':
      const metadataResult = validateJson(
        value,
        'rawMetadata',
        'Custom Metadata',
        false
      );
      return metadataResult.valid ? null : metadataResult.errors[0].message;
      
    case 'vcProvider':
      if (formData?.metadata?.isVerifiableCredential && !value) {
        return 'VC Provider is required when Verifiable Credential is enabled';
      }
      return null;
      
    default:
      return null;
  }
};
