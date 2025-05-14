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
  INVALID_TRANSACTION_HEX = 'invalid_transaction_hex',
  INVALID_RESPONSE = 'invalid_response',
  
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
  
  // Transaction broadcasting errors
  TRANSACTION_BROADCAST_FAILED = 'transaction_broadcast_failed',
  TRANSACTION_BROADCAST_TIMEOUT = 'transaction_broadcast_timeout',
  TRANSACTION_BROADCAST_CANCELLED = 'transaction_broadcast_cancelled',
  NO_ACTIVE_NODES = 'no_active_nodes',

  // Confirmation service specific errors
  TRANSACTION_ALREADY_WATCHED = 'transaction_already_watched',
  CONFIGURATION_ERROR = 'configuration_error',
  EXTERNAL_API_ERROR = 'external_api_error', // More specific than API_ERROR
  RPC_ERROR = 'rpc_error',
  TRANSACTION_CONFIRMATION_ERROR = 'transaction_confirmation_error',
}

/**
 * Interface for error constructor parameters
 */
export interface InscriptionErrorParams {
  code: ErrorCode;
  message: string;
  details?: unknown;
  suggestion?: string;
}

/**
 * Structured error class with detailed information
 */
export class InscriptionError extends Error {
  code: ErrorCode;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: Date;
  details?: unknown;
  suggestion?: string;
  recoverable: boolean;

  constructor(params: InscriptionErrorParams) {
    super(params.message);
    
    this.name = 'InscriptionError';
    this.code = params.code;
    this.details = params.details;
    
    // Get error metadata from mapping
    const errorMeta = ERROR_MESSAGES[this.code] || ERROR_MESSAGES[ErrorCode.UNEXPECTED_ERROR];
    
    this.category = errorMeta.category;
    this.severity = errorMeta.severity;
    this.recoverable = errorMeta.recoverable;
    this.suggestion = params.suggestion || errorMeta.suggestion;
    this.timestamp = new Date();
    
    // Log the error
    ErrorHandler.getInstance().logError(this);
  }
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
  
  // Transaction broadcasting errors
  [ErrorCode.TRANSACTION_BROADCAST_FAILED]: {
    message: "Failed to broadcast transaction.",
    suggestion: "Please try again. If the problem persists, check your network connection.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.NETWORK,
  },
  [ErrorCode.TRANSACTION_BROADCAST_TIMEOUT]: {
    message: "Transaction broadcast timed out.",
    suggestion: "The broadcast operation took too long. Please try again.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.NETWORK,
  },
  [ErrorCode.TRANSACTION_BROADCAST_CANCELLED]: {
    message: "Transaction broadcast was cancelled.",
    suggestion: "The broadcast was cancelled. You can try again if needed.",
    recoverable: true,
    severity: ErrorSeverity.INFO,
    category: ErrorCategory.NETWORK,
  },
  [ErrorCode.NO_ACTIVE_NODES]: {
    message: "No active Bitcoin nodes available for broadcasting.",
    suggestion: "Please try again later or contact support if the issue persists.",
    recoverable: false,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.SYSTEM,
  },
  [ErrorCode.INVALID_TRANSACTION_HEX]: {
    message: "Invalid transaction hex format.",
    suggestion: "The transaction format is invalid. Please verify the transaction data.",
    recoverable: false,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.VALIDATION,
  },
  [ErrorCode.INVALID_RESPONSE]: {
    message: "Invalid response from server.",
    suggestion: "Received an unexpected response. Please try again.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.NETWORK,
  },

  // Confirmation service specific error messages
  [ErrorCode.TRANSACTION_ALREADY_WATCHED]: {
    message: "Transaction is already being watched.",
    suggestion: "No action needed if this is not causing issues. If re-watching is intended, unwatch first.",
    recoverable: false,
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.SYSTEM,
  },
  [ErrorCode.CONFIGURATION_ERROR]: {
    message: "Service configuration error.",
    suggestion: "Please check the service configuration and ensure all required parameters are set correctly.",
    recoverable: false,
    severity: ErrorSeverity.CRITICAL,
    category: ErrorCategory.SYSTEM,
  },
  [ErrorCode.EXTERNAL_API_ERROR]: {
    message: "Error communicating with an external API.",
    suggestion: "The external service may be temporarily unavailable. Please try again later.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.NETWORK,
  },
  [ErrorCode.RPC_ERROR]: {
    message: "Error communicating with the Bitcoin RPC node.",
    suggestion: "Ensure the RPC node is accessible and configured correctly. Check RPC logs for more details.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.NETWORK,
  },
  [ErrorCode.TRANSACTION_CONFIRMATION_ERROR]: {
    message: "An error occurred while trying to confirm the transaction status.",
    suggestion: "This could be due to network issues or problems with the data provider. Retrying may resolve the issue.",
    recoverable: true,
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.NETWORK,
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
      return new InscriptionError({
        code,
        message: customMessage || "Unknown error",
        details,
      });
    }
    
    const error = new InscriptionError({
      code,
      message: customMessage || errorInfo.message,
      details,
    });
    
    return error;
  }
  
  /**
   * Log an error for debugging and tracking
   */
  public logError(error: InscriptionError): void {
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