/**
 * Error Handler for Ordinals Inscription Process
 * 
 * This module provides a comprehensive error handling system for the ordinals
 * inscription process, categorizing errors and providing user-friendly messages.
 */

/**
 * Error categories to classify different types of errors
 */
export enum ErrorCategory {
  NETWORK = 'network',
  WALLET = 'wallet',
  VALIDATION = 'validation',
  SYSTEM = 'system',
}

/**
 * Error severity levels to indicate the impact of errors
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Error codes for specific error types
 */
export enum ErrorCode {
  // Network errors
  NETWORK_DISCONNECTED = 'network_disconnected',
  REQUEST_TIMEOUT = 'request_timeout',
  API_ERROR = 'api_error',
  
  // Wallet errors
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  WALLET_CONNECTION_FAILED = 'wallet_connection_failed',
  WALLET_REJECTED = 'wallet_rejected',
  UTXO_ALREADY_SPENT = 'utxo_already_spent',
  INVALID_UTXO = 'invalid_utxo',
  MISSING_UTXO = 'missing_utxo',
  SIGNING_ERROR = 'signing_error',
  
  // Validation errors
  INVALID_INPUT = 'invalid_input',
  CONTENT_TOO_LARGE = 'content_too_large',
  UNSUPPORTED_CONTENT_TYPE = 'unsupported_content_type',
  INVALID_ADDRESS = 'invalid_address',
  INVALID_TRANSACTION = 'invalid_transaction',
  INVALID_FEE_RATE = 'invalid_fee_rate',
  
  // System errors
  UNEXPECTED_ERROR = 'unexpected_error',
  NOT_IMPLEMENTED = 'not_implemented',
  INITIALIZATION_FAILED = 'initialization_failed',
  STATE_ERROR = 'state_error',
  
  // Transaction-specific errors
  TRANSACTION_FAILED = 'transaction_failed',
  TRANSACTION_REJECTED = 'transaction_rejected',
  TRANSACTION_TIMEOUT = 'transaction_timeout',
  COMMIT_TX_FAILED = 'commit_tx_failed',
  REVEAL_TX_FAILED = 'reveal_tx_failed',
}

/**
 * Structured error object with detailed information
 */
export interface InscriptionError {
  code: ErrorCode;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: Date;
  details?: unknown;
  suggestion?: string;
  recoverable: boolean;
}

/**
 * Error mapping for user-friendly error messages and suggestions
 */
const ERROR_MESSAGES: Record<
  ErrorCode, 
  { message: string; suggestion?: string; recoverable: boolean; severity: ErrorSeverity; category: ErrorCategory }
> = {
  // Network errors
  [ErrorCode.NETWORK_DISCONNECTED]: {
    message: "Lost connection to the network.",
    suggestion: "Please check your internet connection and try again.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.NETWORK,
  },
  [ErrorCode.REQUEST_TIMEOUT]: {
    message: "The request timed out.",
    suggestion: "The server is taking too long to respond. Please try again later.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.NETWORK,
  },
  [ErrorCode.API_ERROR]: {
    message: "Error connecting to the API.",
    suggestion: "There was a problem with the server. Please try again later.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.NETWORK,
  },
  
  // Wallet errors
  [ErrorCode.INSUFFICIENT_FUNDS]: {
    message: "Insufficient funds in wallet.",
    suggestion: "Please add more funds to your wallet before creating an inscription.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.WALLET,
  },
  [ErrorCode.WALLET_CONNECTION_FAILED]: {
    message: "Failed to connect to wallet.",
    suggestion: "Please make sure your wallet is unlocked and try again.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.WALLET,
  },
  [ErrorCode.WALLET_REJECTED]: {
    message: "Transaction rejected by wallet.",
    suggestion: "You declined the transaction. Please try again and approve the transaction in your wallet.",
    recoverable: true,
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.WALLET,
  },
  [ErrorCode.UTXO_ALREADY_SPENT]: {
    message: "The selected UTXO has already been spent.",
    suggestion: "Please refresh your wallet and select a different UTXO.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.WALLET,
  },
  [ErrorCode.INVALID_UTXO]: {
    message: "The selected UTXO is invalid.",
    suggestion: "Please select a different UTXO for the inscription.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.WALLET,
  },
  [ErrorCode.MISSING_UTXO]: {
    message: "No UTXO selected.",
    suggestion: "Please select a UTXO to use for the inscription.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.WALLET,
  },
  [ErrorCode.SIGNING_ERROR]: {
    message: "Failed to sign the transaction.",
    suggestion: "Please check your wallet connection and try again.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.WALLET,
  },
  
  // Validation errors
  [ErrorCode.INVALID_INPUT]: {
    message: "Invalid input provided.",
    suggestion: "Please check the input values and try again.",
    recoverable: true,
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.VALIDATION,
  },
  [ErrorCode.CONTENT_TOO_LARGE]: {
    message: "Content is too large for inscription.",
    suggestion: "Please reduce the size of your content. Maximum size is 1.5MB.",
    recoverable: true,
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.VALIDATION,
  },
  [ErrorCode.UNSUPPORTED_CONTENT_TYPE]: {
    message: "Unsupported content type.",
    suggestion: "Please use a supported content type like text, JSON, or common image formats.",
    recoverable: true,
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.VALIDATION,
  },
  [ErrorCode.INVALID_ADDRESS]: {
    message: "Invalid Bitcoin address.",
    suggestion: "Please provide a valid Bitcoin address.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.VALIDATION,
  },
  [ErrorCode.INVALID_TRANSACTION]: {
    message: "Invalid transaction structure.",
    suggestion: "There was a problem creating the transaction. Please try again.",
    recoverable: false,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.VALIDATION,
  },
  [ErrorCode.INVALID_FEE_RATE]: {
    message: "Invalid fee rate.",
    suggestion: "Please provide a valid fee rate greater than zero.",
    recoverable: true,
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.VALIDATION,
  },
  
  // System errors
  [ErrorCode.UNEXPECTED_ERROR]: {
    message: "An unexpected error occurred.",
    suggestion: "Please try again. If the problem persists, contact support.",
    recoverable: false,
    severity: ErrorSeverity.CRITICAL,
    category: ErrorCategory.SYSTEM,
  },
  [ErrorCode.NOT_IMPLEMENTED]: {
    message: "This feature is not yet implemented.",
    suggestion: "This feature is under development. Please check back later.",
    recoverable: false,
    severity: ErrorSeverity.INFO,
    category: ErrorCategory.SYSTEM,
  },
  [ErrorCode.INITIALIZATION_FAILED]: {
    message: "Failed to initialize the inscription process.",
    suggestion: "Please refresh the page and try again.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.SYSTEM,
  },
  [ErrorCode.STATE_ERROR]: {
    message: "Invalid application state.",
    suggestion: "Please refresh the page and try again.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.SYSTEM,
  },
  
  // Transaction-specific errors
  [ErrorCode.TRANSACTION_FAILED]: {
    message: "Transaction failed.",
    suggestion: "The transaction could not be processed. Please try again.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.WALLET,
  },
  [ErrorCode.TRANSACTION_REJECTED]: {
    message: "Transaction rejected by the network.",
    suggestion: "The transaction was rejected. This might be due to low fees or other validation errors.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.NETWORK,
  },
  [ErrorCode.TRANSACTION_TIMEOUT]: {
    message: "Transaction timed out.",
    suggestion: "The transaction took too long to confirm. You may need to try again with a higher fee rate.",
    recoverable: true,
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.NETWORK,
  },
  [ErrorCode.COMMIT_TX_FAILED]: {
    message: "Commit transaction failed.",
    suggestion: "Failed to create the commit transaction. Please check your wallet and try again.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.WALLET,
  },
  [ErrorCode.REVEAL_TX_FAILED]: {
    message: "Reveal transaction failed.",
    suggestion: "Failed to create the reveal transaction. Your funds from the commit transaction may still be available.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.WALLET,
  },
};

/**
 * ErrorHandler class for managing errors in the inscription process
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: InscriptionError[] = [];
  
  /**
   * Get the singleton instance of ErrorHandler
   */
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }
  
  /**
   * Create an error object with detailed information
   */
  public createError(
    code: ErrorCode,
    details?: unknown,
    customMessage?: string
  ): InscriptionError {
    const errorInfo = ERROR_MESSAGES[code];
    
    if (!errorInfo) {
      // Fallback for unknown error codes
      return {
        code,
        message: customMessage || "Unknown error",
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date(),
        details,
        recoverable: false,
      };
    }
    
    const error: InscriptionError = {
      code,
      message: customMessage || errorInfo.message,
      category: errorInfo.category,
      severity: errorInfo.severity,
      timestamp: new Date(),
      suggestion: errorInfo.suggestion,
      recoverable: errorInfo.recoverable,
      details,
    };
    
    // Log the error
    this.logError(error);
    
    return error;
  }
  
  /**
   * Log an error for debugging and tracking
   */
  private logError(error: InscriptionError): void {
    // Add to internal log
    this.errorLog.push(error);
    
    // Also log to console for debugging
    console.error(
      `[${error.category.toUpperCase()}] ${error.code}: ${error.message}`,
      error.details || ''
    );
  }
  
  /**
   * Get all logged errors
   */
  public getErrorLog(): InscriptionError[] {
    return [...this.errorLog];
  }
  
  /**
   * Clear the error log
   */
  public clearErrorLog(): void {
    this.errorLog = [];
  }
  
  /**
   * Handle an Error instance and convert it to an InscriptionError
   */
  public handleError(error: unknown): InscriptionError {
    // Handle specific error types
    if (error instanceof Error) {
      // Try to extract error code if it's embedded in the message
      for (const code of Object.values(ErrorCode)) {
        if (error.message.includes(code)) {
          return this.createError(code as ErrorCode, error, error.message);
        }
      }
      
      // Generic error handling
      return this.createError(
        ErrorCode.UNEXPECTED_ERROR,
        error,
        error.message
      );
    }
    
    // Handle non-Error objects
    return this.createError(
      ErrorCode.UNEXPECTED_ERROR,
      error,
      typeof error === 'string' ? error : 'Unknown error occurred'
    );
  }
  
  /**
   * Check if an error is recoverable
   */
  public isRecoverable(error: InscriptionError): boolean {
    return error.recoverable;
  }
  
  /**
   * Get a user-friendly message for an error
   */
  public getUserFriendlyMessage(error: InscriptionError): string {
    return error.suggestion || error.message;
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance(); 