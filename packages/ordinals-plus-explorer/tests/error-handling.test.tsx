import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorDisplay from '../src/components/ui/ErrorDisplay';
import { createFetchClient } from '../src/utils/fetchUtils';
import { InscriptionError, ErrorCode } from '../../ordinalsplus/src/utils/error-handler';

/**
 * Test suite for comprehensive error handling.
 * This is related to Task 8: Implement Comprehensive Error Handling
 */
describe('Comprehensive Error Handling', () => {
  test('should handle network failures gracefully', async () => {
    const fetchSpy = vi.fn().mockRejectedValueOnce(new Error('offline'));
    // @ts-ignore
    global.fetch = fetchSpy;
    const client = createFetchClient({ baseURL: 'http://example.com' });
    await expect(client.get('/test')).rejects.toMatchObject({ isNetworkError: true });
  });

  test('should display user-friendly error messages', () => {
    const error = new InscriptionError({ code: ErrorCode.NETWORK_DISCONNECTED, message: 'offline' });
    render(<ErrorDisplay error={error} />);
    expect(screen.getByText('Lost connection to the network.')).toBeInTheDocument();
    expect(screen.getByText('Please check your internet connection and try again.')).toBeInTheDocument();
  });

  test('should provide recovery paths for non-critical errors', () => {
    const error = new InscriptionError({ code: ErrorCode.WALLET_REJECTED, message: 'rejected' });
    const onRecover = vi.fn();
    render(<ErrorDisplay error={error} onRecoveryAction={onRecover} />);
    const btn = screen.getByRole('button', { name: /recover/i });
    fireEvent.click(btn);
    expect(onRecover).toHaveBeenCalled();
  });

});
