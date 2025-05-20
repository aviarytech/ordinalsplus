/**
 * Transaction Status Display Component
 * 
 * This component provides a UI for displaying transaction status information.
 * It shows the current status of commit and reveal transactions with progress indicators
 * and links to block explorers.
 */

import { BitcoinNetwork } from '../types';
import {
  transactionTracker,
  TransactionStatus, 
  TransactionProgressEvent,
  TransactionType,
  TransactionStatusTracker,
  TrackedTransaction
} from '../transactions/transaction-status-tracker';

/**
 * Transaction status display properties
 */
export interface TransactionStatusDisplayProps {
  /** ID of the transaction to display status for */
  transactionId?: string;
  /** Bitcoin network configuration */
  network: BitcoinNetwork;
  /** Optional custom tracker instance (defaults to singleton tracker) */
  tracker?: TransactionStatusTracker;
  /** Optional callback for when status changes */
  onStatusChange?: (status: TransactionStatus) => void;
  /** Optional callback for when the component encounters an error */
  onError?: (error: Error) => void;
}

/**
 * Status item for rendering
 */
export interface StatusItem {
  icon: string;
  message: string;
  timestamp: Date;
  status: TransactionStatus;
  link?: string;
  error?: string;
}

/**
 * Transaction status display component
 */
export class TransactionStatusDisplay {
  private props: TransactionStatusDisplayProps;
  private tracker: TransactionStatusTracker;
  private container: HTMLElement | null = null;
  private statusUpdateInterval: number | null = null;
  
  /**
   * Create a new transaction status display
   */
  constructor(props: TransactionStatusDisplayProps) {
    this.props = props;
    this.tracker = props.tracker || transactionTracker;
  }
  
  /**
   * Mount the component to a DOM element
   */
  mount(element: HTMLElement): void {
    this.container = element;
    this.render();
    
    // Set up interval to periodically check for status updates
    this.statusUpdateInterval = window.setInterval(() => {
      this.render();
    }, 2000); // Check every 2 seconds
  }
  
  /**
   * Unmount and clean up the component
   */
  unmount(): void {
    if (this.statusUpdateInterval !== null) {
      window.clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
    
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
  
  /**
   * Render the component
   */
  render(): void {
    if (!this.container) {
      return;
    }
    
    try {
      const { transactionId } = this.props;
      
      // If no transaction ID is provided, display a message
      if (!transactionId) {
        this.container.innerHTML = `
          <div class="transaction-status-empty">
            <p>No transaction in progress</p>
          </div>
        `;
        return;
      }
      
      // Get the transaction and its progress events
      const transaction = this.tracker.getTransaction(transactionId);
      
      if (!transaction) {
        this.container.innerHTML = `
          <div class="transaction-status-not-found">
            <p>Transaction not found: ${transactionId}</p>
          </div>
        `;
        return;
      }
      
      // Get progress events
      const events = this.tracker.getTransactionProgressEvents(transactionId);
      
      // Get any child transactions (like reveal after commit)
      const childTransactions = this.tracker.getChildTransactions(transactionId);
      
      // Create status items for this transaction and its children
      const statusItems = this.createStatusItems(transaction, events);
      
      // Create HTML for the status display
      const transactionTitle = transaction.type === TransactionType.COMMIT 
        ? 'Commit Transaction' 
        : 'Reveal Transaction';
      
      // Generate the HTML
      const statusItemsHtml = statusItems.map(item => `
        <div class="transaction-status-item transaction-status-${item.status.toLowerCase()}">
          <div class="transaction-status-icon">${item.icon}</div>
          <div class="transaction-status-content">
            <div class="transaction-status-message">${item.message}</div>
            <div class="transaction-status-timestamp">${this.formatDate(item.timestamp)}</div>
            ${item.link ? `<div class="transaction-status-link"><a href="${item.link}" target="_blank">View in Explorer</a></div>` : ''}
            ${item.error ? `<div class="transaction-status-error">${item.error}</div>` : ''}
          </div>
        </div>
      `).join('');
      
      // Render child transactions if any
      let childTransactionsHtml = '';
      
      if (childTransactions.length > 0) {
        const childTx = childTransactions[0]; // For now just show the first child
        const childEvents = this.tracker.getTransactionProgressEvents(childTx.id);
        const childStatusItems = this.createStatusItems(childTx, childEvents);
        
        const childStatusItemsHtml = childStatusItems.map(item => `
          <div class="transaction-status-item transaction-status-${item.status.toLowerCase()}">
            <div class="transaction-status-icon">${item.icon}</div>
            <div class="transaction-status-content">
              <div class="transaction-status-message">${item.message}</div>
              <div class="transaction-status-timestamp">${this.formatDate(item.timestamp)}</div>
              ${item.link ? `<div class="transaction-status-link"><a href="${item.link}" target="_blank">View in Explorer</a></div>` : ''}
              ${item.error ? `<div class="transaction-status-error">${item.error}</div>` : ''}
            </div>
          </div>
        `).join('');
        
        childTransactionsHtml = `
          <div class="transaction-status-child">
            <h3>Reveal Transaction</h3>
            <div class="transaction-status-items">
              ${childStatusItemsHtml}
            </div>
          </div>
        `;
      }
      
      // Put together the final HTML
      this.container.innerHTML = `
        <div class="transaction-status">
          <h2>${transactionTitle}</h2>
          <div class="transaction-status-items">
            ${statusItemsHtml}
          </div>
          ${childTransactionsHtml}
        </div>
      `;
      
      // Notify of status changes
      if (this.props.onStatusChange && transaction) {
        this.props.onStatusChange(transaction.status);
      }
    } catch (error) {
      console.error('Error rendering transaction status:', error);
      
      if (this.container) {
        this.container.innerHTML = `
          <div class="transaction-status-error">
            <p>Error displaying transaction status</p>
          </div>
        `;
      }
      
      if (this.props.onError && error instanceof Error) {
        this.props.onError(error);
      }
    }
  }
  
  /**
   * Create status items from transaction and events
   */
  private createStatusItems(transaction: TrackedTransaction, events: TransactionProgressEvent[]): StatusItem[] {
    const items: StatusItem[] = [];
    
    // Add main transaction status
    const txid = transaction.txid || 'Pending';
    let statusMessage = '';
    let statusIcon = '';
    
    switch (transaction.status) {
      case TransactionStatus.PENDING:
        statusMessage = 'Transaction is being prepared';
        statusIcon = '⏳';
        break;
      case TransactionStatus.CONFIRMING:
        statusMessage = 'Transaction has been sent to the network';
        statusIcon = '🔄';
        break;
      case TransactionStatus.CONFIRMED:
        statusMessage = 'Transaction has been confirmed';
        statusIcon = '✅';
        break;
      case TransactionStatus.FAILED:
        statusMessage = transaction.error?.message || 'Transaction failed';
        statusIcon = '❌';
        break;
      default:
        statusMessage = `Transaction status: ${transaction.status}`;
        statusIcon = '❓';
    }
    
    // Add the main status item
    items.push({
      icon: statusIcon,
      message: statusMessage,
      timestamp: transaction.lastUpdatedAt,
      status: transaction.status,
      link: transaction.txid ? this.tracker.getTransactionExplorerUrl(transaction.txid, this.props.network) : undefined,
      error: transaction.error?.message
    });
    
    // Add progress events as status items
    for (const event of events) {
      items.push({
        icon: '📋',
        message: event.message,
        timestamp: event.timestamp,
        status: transaction.status
      });
    }
    
    // Sort by timestamp, most recent first
    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  /**
   * Format a date for display
   */
  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    }).format(date);
  }
} 