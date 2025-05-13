/**
 * Error Categories
 */
export enum ErrorCategory {
  GENERAL = 'GENERAL',
  NETWORK = 'NETWORK',
  BLOCKCHAIN = 'BLOCKCHAIN',
  WALLET = 'WALLET',
  VALIDATION = 'VALIDATION',
  INSCRIPTION = 'INSCRIPTION',
  SERVER = 'SERVER',
  TRANSACTION = 'TRANSACTION',
  AUTHENTICATION = 'AUTHENTICATION',
  PERMISSION = 'PERMISSION',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Error Severity Levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Error Codes
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
 * Structured Error Interface
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