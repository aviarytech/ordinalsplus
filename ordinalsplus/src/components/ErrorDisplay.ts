/**
 * Error Display Component
 * 
 * This component provides a UI for displaying error messages to users
 * in a user-friendly way, with appropriate styling based on error severity.
 */

import { ErrorSeverity, InscriptionError, errorHandler } from '../utils/error-handler';

/**
 * Error display properties
 */
export interface ErrorDisplayProps {
  /** Container element to render the error display in */
  container: HTMLElement;
  /** Optional callback for when the dismiss button is clicked */
  onDismiss?: () => void;
  /** Optional timeout in milliseconds to automatically dismiss the error */
  autoHideTimeout?: number;
  /** Optional flag to show a dismiss button */
  showDismissButton?: boolean;
  /** Optional custom classes for styling */
  customClasses?: {
    wrapper?: string;
    icon?: string;
    content?: string;
    message?: string;
    suggestion?: string;
    dismissButton?: string;
  };
}

/**
 * ErrorDisplay class for rendering error messages
 */
export class ErrorDisplay {
  private props: ErrorDisplayProps;
  private currentError?: InscriptionError;
  private timeoutId?: number;
  
  /**
   * Create a new ErrorDisplay instance
   */
  constructor(props: ErrorDisplayProps) {
    this.props = {
      ...props,
      showDismissButton: props.showDismissButton !== false, // Default to true
    };
    
    // Initialize the container
    this.initContainer();
  }
  
  /**
   * Initialize the container with base styling
   */
  private initContainer(): void {
    // Add base styling if needed
    if (!this.props.container.classList.contains('error-display-container')) {
      this.props.container.classList.add('error-display-container');
    }
  }
  
  /**
   * Show an error message
   */
  public showError(error: InscriptionError | Error | string): void {
    // Clear any existing timeout
    this.clearTimeout();
    
    // Convert error to InscriptionError if needed
    if (!(error as InscriptionError).code) {
      if (error instanceof Error) {
        this.currentError = errorHandler.handleError(error);
      } else {
        this.currentError = errorHandler.createError(
          // Use a generic error code
          'unexpected_error' as any,
          null,
          typeof error === 'string' ? error : 'Unknown error'
        );
      }
    } else {
      this.currentError = error as InscriptionError;
    }
    
    // Render the error
    this.render();
    
    // Set auto-hide timeout if specified
    if (this.props.autoHideTimeout) {
      this.timeoutId = window.setTimeout(() => {
        this.hideError();
      }, this.props.autoHideTimeout);
    }
  }
  
  /**
   * Hide the error message
   */
  public hideError(): void {
    this.clearTimeout();
    this.currentError = undefined;
    this.props.container.innerHTML = '';
  }
  
  /**
   * Clear the auto-hide timeout
   */
  private clearTimeout(): void {
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }
  
  /**
   * Get icon based on error severity
   */
  private getIcon(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.INFO:
        return '&#8505;'; // Info symbol
      case ErrorSeverity.WARNING:
        return '&#9888;'; // Warning symbol
      case ErrorSeverity.ERROR:
        return '&#10060;'; // X symbol
      case ErrorSeverity.CRITICAL:
        return '&#9888;'; // Warning symbol (same as warning but will be styled differently)
      default:
        return '&#10067;'; // Question mark for unknown severity
    }
  }
  
  /**
   * Get CSS classes based on error severity
   */
  private getSeverityClasses(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.INFO:
        return 'error-display-info';
      case ErrorSeverity.WARNING:
        return 'error-display-warning';
      case ErrorSeverity.ERROR:
        return 'error-display-error';
      case ErrorSeverity.CRITICAL:
        return 'error-display-critical';
      default:
        return 'error-display-default';
    }
  }
  
  /**
   * Render the error message
   */
  public render(): void {
    if (!this.currentError) {
      return;
    }
    
    try {
      const { message, suggestion, severity = ErrorSeverity.ERROR } = this.currentError;
      const severityClasses = this.getSeverityClasses(severity);
      const icon = this.getIcon(severity);
      
      // Custom classes or defaults
      const {
        wrapper = '',
        icon: iconClass = '',
        content: contentClass = '',
        message: messageClass = '',
        suggestion: suggestionClass = '',
        dismissButton: dismissButtonClass = '',
      } = this.props.customClasses || {};
      
      // Construct HTML
      const html = `
        <div class="error-display ${severityClasses} ${wrapper}">
          <div class="error-display-icon ${iconClass}">${icon}</div>
          <div class="error-display-content ${contentClass}">
            <div class="error-display-message ${messageClass}">${message}</div>
            ${suggestion ? `<div class="error-display-suggestion ${suggestionClass}">${suggestion}</div>` : ''}
          </div>
          ${this.props.showDismissButton ? `
            <div class="error-display-dismiss ${dismissButtonClass}">
              <button type="button">&times;</button>
            </div>
          ` : ''}
        </div>
      `;
      
      // Set the container content
      this.props.container.innerHTML = html;
      
      // Add event listener for dismiss button
      if (this.props.showDismissButton) {
        const dismissButton = this.props.container.querySelector('.error-display-dismiss button');
        if (dismissButton) {
          dismissButton.addEventListener('click', () => {
            this.hideError();
            if (this.props.onDismiss) {
              this.props.onDismiss();
            }
          });
        }
      }
    } catch (error) {
      console.error('Error rendering error display:', error);
      
      // Fallback rendering for critical errors in the error display itself
      this.props.container.innerHTML = `
        <div class="error-display error-display-critical">
          <div class="error-display-message">Failed to display error message</div>
        </div>
      `;
    }
  }
}

/**
 * Default CSS styles for ErrorDisplay
 * 
 * This can be included once in your application
 */
export const ErrorDisplayStyles = `
  .error-display-container {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    max-width: 100%;
    margin: 10px 0;
  }
  
  .error-display {
    display: flex;
    padding: 12px;
    border-radius: 6px;
    background-color: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    margin-bottom: 10px;
  }
  
  .error-display-icon {
    font-size: 1.2rem;
    margin-right: 12px;
    display: flex;
    align-items: center;
  }
  
  .error-display-content {
    flex: 1;
  }
  
  .error-display-message {
    font-weight: 500;
    margin-bottom: 4px;
  }
  
  .error-display-suggestion {
    font-size: 0.9rem;
    opacity: 0.9;
  }
  
  .error-display-dismiss {
    display: flex;
    align-items: flex-start;
  }
  
  .error-display-dismiss button {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    opacity: 0.5;
    padding: 0;
    margin-left: 8px;
  }
  
  .error-display-dismiss button:hover {
    opacity: 0.8;
  }
  
  /* Severity-specific styles */
  .error-display-info {
    border-left: 4px solid #0dcaf0;
    background-color: #f0fdff;
  }
  
  .error-display-info .error-display-icon {
    color: #0dcaf0;
  }
  
  .error-display-warning {
    border-left: 4px solid #ffc107;
    background-color: #fffbeb;
  }
  
  .error-display-warning .error-display-icon {
    color: #ffc107;
  }
  
  .error-display-error {
    border-left: 4px solid #dc3545;
    background-color: #fff5f5;
  }
  
  .error-display-error .error-display-icon {
    color: #dc3545;
  }
  
  .error-display-critical {
    border-left: 4px solid #7209b7;
    background-color: #f8f0fc;
  }
  
  .error-display-critical .error-display-icon {
    color: #7209b7;
  }
  
  /* Dark mode styles */
  @media (prefers-color-scheme: dark) {
    .error-display {
      background-color: #1e1e1e;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
    
    .error-display-info {
      background-color: rgba(13, 202, 240, 0.1);
    }
    
    .error-display-warning {
      background-color: rgba(255, 193, 7, 0.1);
    }
    
    .error-display-error {
      background-color: rgba(220, 53, 69, 0.1);
    }
    
    .error-display-critical {
      background-color: rgba(114, 9, 183, 0.1);
    }
    
    .error-display-message {
      color: #e1e1e1;
    }
    
    .error-display-suggestion {
      color: #b0b0b0;
    }
  }
`;

/**
 * Helper function to inject error display styles into the document
 */
export function injectErrorDisplayStyles(): void {
  if (!document.getElementById('error-display-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'error-display-styles';
    styleElement.textContent = ErrorDisplayStyles;
    document.head.appendChild(styleElement);
  }
} 