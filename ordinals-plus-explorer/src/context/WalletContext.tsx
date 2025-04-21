import React, { createContext, useContext, ReactNode } from 'react';
import { useDirectWallet, DirectWalletType, Utxo } from '../hooks/useDirectWallet';

// Re-export Utxo type
export type { Utxo };

// Define the shape of our wallet context using the same types as useDirectWallet
interface WalletContextType {
  connect: (type: DirectWalletType) => Promise<boolean>;
  disconnect: () => Promise<void>;
  signPsbt: (psbtHex: string, options?: any) => Promise<string>;
  getUtxos: () => Promise<Utxo[]>;
  connected: boolean;
  address: string | null;
  publicKey: string | null;
  isConnecting: boolean;
  error: string | null;
  walletType: DirectWalletType | null;
  network: string | null;
  hasUnisat: boolean;
  hasXverse: boolean;
  hasMagicEden: boolean;
  lastConnectionAttempt: string | null;
}

// Create the context with default values
const WalletContext = createContext<WalletContextType>({
  connect: async () => false,
  disconnect: async () => {},
  signPsbt: async () => { throw new Error('Wallet not connected or signPsbt not implemented'); },
  getUtxos: async () => { console.warn('Default getUtxos called'); return []; },
  connected: false,
  address: null,
  publicKey: null,
  isConnecting: false,
  error: null,
  walletType: null,
  network: null,
  hasUnisat: false,
  hasXverse: false,
  hasMagicEden: false,
  lastConnectionAttempt: null
});

// Provider component
export const WalletProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  // Use our direct wallet hook
  const walletData = useDirectWallet();
  
  return (
    <WalletContext.Provider value={walletData}>
      {children}
    </WalletContext.Provider>
  );
};

// Hook for easy context consumption
export const useWallet = () => useContext(WalletContext);

export default WalletContext; 