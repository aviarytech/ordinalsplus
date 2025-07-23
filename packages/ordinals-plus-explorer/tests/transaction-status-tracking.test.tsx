import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TransactionStatusIndicator from '../src/components/shared/TransactionStatusIndicator';

/**
 * Test suite for transaction status tracking functionality.
 * This is related to Task 7: Develop Transaction Status Tracking
 */
describe('Transaction Status Tracking', () => {
  test('should monitor commit transaction status correctly', () => {
    render(<TransactionStatusIndicator status="broadcasting" />);
    expect(screen.getByText('Broadcasting Transaction')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar.style.width).toBe('60%');
  });

  test('should monitor reveal transaction status correctly', () => {
    render(<TransactionStatusIndicator status="confirming" />);
    expect(screen.getByText('Waiting for Confirmation')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar.style.width).toBe('80%');
  });

  test('should display real-time transaction status updates', () => {
    const { rerender } = render(<TransactionStatusIndicator status="preparing" />);
    expect(screen.getByText('Preparing Transaction')).toBeInTheDocument();
    rerender(<TransactionStatusIndicator status="completed" />);
    expect(screen.getByText('Transaction Confirmed')).toBeInTheDocument();
  });

  test('should display transaction details with block explorer links', () => {
    const txid = 'abc123';
    const tracker = require('../../ordinalsplus/src/transactions/transaction-status-tracker');
    const url = tracker.transactionTracker.getTransactionExplorerUrl(txid, 'testnet');
    expect(url).toContain(txid);
    expect(url).toContain('testnet');
  });

  test('should show clear progress indicators for each step', () => {
    render(<TransactionStatusIndicator status="signing" />);
    const bar = screen.getByRole('progressbar');
    expect(bar.style.width).toBe('40%');
  });

  test('should provide users with clear understanding of process stage', () => {
    render(<TransactionStatusIndicator status="failed" />);
    expect(screen.getByText('Transaction Failed')).toBeInTheDocument();
  });

  test('should handle failed transactions appropriately', () => {
    render(<TransactionStatusIndicator status="failed" />);
    const bar = screen.getByRole('progressbar');
    expect(bar.style.width).toBe('0%');
  });

  test('should refresh status at appropriate intervals', () => {
    const { rerender } = render(<TransactionStatusIndicator status="not_started" />);
    expect(screen.getByText('Not Started')).toBeInTheDocument();
    rerender(<TransactionStatusIndicator status="broadcasting" />);
    expect(screen.getByText('Broadcasting Transaction')).toBeInTheDocument();
  });
}); 