import React, { ReactNode } from 'react';
import { vi } from 'vitest';
import WalletContext, { Utxo } from '../../src/context/WalletContext';

interface WalletProviderMockProps {
  children: ReactNode;
  customValues?: Partial<typeof defaultContextValue>;
}

// Extended UTXO type with status property
interface ExtendedUtxo extends Utxo {
  status?: {
    confirmed?: boolean;
    block_height?: number;
    [key: string]: any;
  };
}

// Mock UTXOs for testing
const mockUtxos: ExtendedUtxo[] = [
  { txid: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', vout: 0, value: 100000, scriptPubKey: '00141234567890abcdef1234567890abcdef123456' },
  { txid: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', vout: 1, value: 50000, scriptPubKey: '00141234567890abcdef1234567890abcdef123456' },
  { txid: '9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba', vout: 0, value: 200000, status: { confirmed: true, block_height: 100 }, scriptPubKey: '00141234567890abcdef1234567890abcdef123456' },
  { txid: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210', vout: 1, value: 75000, status: { confirmed: true, block_height: 200 }, scriptPubKey: '00141234567890abcdef1234567890abcdef123456' },
];

const defaultContextValue = {
  connect: vi.fn(async () => true),
  disconnect: vi.fn(async () => {}),
  signPsbt: vi.fn(async () => "signed_psbt_hex"),
  getUtxos: vi.fn(async () => mockUtxos),
  connected: true,
  address: 'tb1qtest123456789',
  publicKey: '03xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  isConnecting: false,
  error: null,
  walletType: 'unisat' as const,
  network: 'testnet',
  hasUnisat: true,
  hasXverse: false,
  hasMagicEden: false,
  lastConnectionAttempt: null
};

export const WalletProviderMock: React.FC<WalletProviderMockProps> = ({ 
  children,
  customValues = {}
}) => {
  const contextValue = {
    ...defaultContextValue,
    ...customValues
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

export { mockUtxos, defaultContextValue }; 