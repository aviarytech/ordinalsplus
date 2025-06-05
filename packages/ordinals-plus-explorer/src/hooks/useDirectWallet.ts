import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../context/ApiContext';

export type DirectWalletType = 'unisat' | 'xverse' | 'magiceden';

// Define a basic Utxo type (adjust fields based on actual wallet responses)
export interface Utxo {
  txid: string;
  vout: number;
  value: number; // Amount in satoshis
  scriptPubKey?: string; // Optional script pubkey hex
  satNumber?: number; // Add satNumber property
}

interface DirectWalletHook {
  connect: (type: DirectWalletType) => Promise<boolean>;
  disconnect: () => Promise<void>;
  signPsbt: (psbtHex: string, options?: any) => Promise<string>;
  getUtxos: () => Promise<Utxo[]>; // Added function to get UTXOs
  connected: boolean;
  address: string | null;
  publicKey: string | null; // Added public key state
  isConnecting: boolean;
  error: string | null;
  walletType: DirectWalletType | null;
  network: string | null;
  hasUnisat: boolean;
  hasXverse: boolean;
  hasMagicEden: boolean;
  lastConnectionAttempt: string | null;
}

/**
 * A hook that provides direct connection to Bitcoin wallets
 * without relying on LaserEyes
 */
export const useDirectWallet = (): DirectWalletHook => {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null); // Added state
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<DirectWalletType | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [lastConnectionAttempt, setLastConnectionAttempt] = useState<string | null>(null);
  
  // Wallet detection
  const [hasUnisat, setHasUnisat] = useState(false);
  const [hasXverse, setHasXverse] = useState(false);
  const [hasMagicEden, setHasMagicEden] = useState(false);

  // Get ApiService at the top level of the hook
  const { apiService } = useApi(); 

  // Helper for consistent logging
  const logMessage = (message: string) => {
    console.log(`[DirectWallet] ${message}`);
    return message;
  };

  // Check for wallet extensions
  useEffect(() => {
    const checkWallets = () => {
      logMessage('Checking available wallets...');
      
      const unisatDetected = 'unisat' in window;
      const xverseDetected = 'xverse' in window;
      const magicEdenDetected = typeof (window as any).MagicEden === 'object' && (window as any).MagicEden !== null;
      
      logMessage(`Wallet detection results - UniSat: ${unisatDetected}, Xverse: ${xverseDetected}, MagicEden: ${magicEdenDetected}`);
      
      setHasUnisat(unisatDetected);
      setHasXverse(xverseDetected);
      setHasMagicEden(magicEdenDetected);
    };
    
    checkWallets();
    // Check again after a delay (some wallets load asynchronously)
    const timer = setTimeout(checkWallets, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  // Update network state when wallet connection changes
  const updateNetwork = useCallback(async () => {
    if (!connected || !walletType) {
      setNetwork(null);
      return;
    }
    try {
      logMessage(`Checking network for ${walletType}...`);
      let networkInfo: string | null = null;
      if (walletType === 'unisat' && hasUnisat) {
        networkInfo = await (window as any).unisat.getNetwork();
        if (networkInfo === 'livenet') {
          networkInfo = 'mainnet';
        } else if (networkInfo === 'unknown') {
          networkInfo = 'signet';
        }
      } else if (walletType === 'xverse' && hasXverse) {
        // Xverse getNetwork might not be standard, often network is part of account info
        // Assuming it's derived during connection for now. Re-check if needed.
        // We might need to re-request account info or find a specific network method.
        logMessage('Xverse network check might require re-requesting accounts or specific method.');
        // For now, rely on network set during connection.
        networkInfo = network; // Keep existing network state if check is complex
      } else if (walletType === 'magiceden' && hasMagicEden) {
        // Magic Eden - Assume mainnet or check if a network method exists
        logMessage('Magic Eden network assumed mainnet. Check for specific method if needed.');
        networkInfo = 'mainnet'; // Default assumption
      }
      logMessage(`Wallet network reported: ${networkInfo}`);
      setNetwork(networkInfo);
    } catch (err) {
      logMessage(`Error fetching network: ${err instanceof Error ? err.message : String(err)}`);
      setNetwork(null); // Clear network on error
    }
  }, [connected, walletType, hasUnisat, hasXverse, hasMagicEden, network]); // Added network dependency

  // Effect to update network when connection state changes
  useEffect(() => {
    updateNetwork();
  }, [connected, walletType, updateNetwork]);

  // Connect to wallet
  const connect = useCallback(async (type: DirectWalletType) => {
    setIsConnecting(true);
    setError(null);
    setLastConnectionAttempt(type);
    setNetwork(null); // Reset network on new connection attempt
    
    try {
      let result = false;
      let connectedAddress: string | null = null;
      let connectedNetwork: string | null = null;
      let connectedPublicKey: string | null = null; // Variable to hold pubkey
      
      if (type === 'unisat') {
        if (!hasUnisat) throw new Error(logMessage('UniSat wallet not detected'));
        const unisat = (window as any).unisat;
        logMessage('Requesting accounts from UniSat...');
        const accounts = await unisat.requestAccounts();
        logMessage(`UniSat returned accounts: ${JSON.stringify(accounts)}`);
        if (accounts && accounts.length > 0) {
          connectedAddress = accounts[0];
          try {
            connectedNetwork = await unisat.getNetwork();
            if (connectedNetwork === 'livenet') {
              connectedNetwork = 'mainnet';
            } else if (connectedNetwork === 'unknown') {
              connectedNetwork = 'signet';
            }
            connectedPublicKey = await unisat.getPublicKey(); // Get public key
            logMessage(`Network: ${connectedNetwork}, PublicKey: ${connectedPublicKey}`);
          } catch (err) {
            logMessage(`Failed to get network/publicKey: ${err instanceof Error ? err.message : String(err)}`);
          }
          result = true;
        } else {
          throw new Error(logMessage('No accounts returned from UniSat'));
        }
      } else if (type === 'xverse') {
        if (!hasXverse) throw new Error(logMessage('Xverse wallet not detected'));
        const xverseProvider = (window as any).xverse?.bitcoin;
        if (!xverseProvider) throw new Error(logMessage('Xverse Bitcoin API not available'));
        logMessage('Requesting accounts from Xverse...');
        // Xverse uses `request('getAccounts', { purposes: ['payment'], network: { type: 'Mainnet' | 'Testnet' } })`
        // We need to decide which network to request initially or handle multiple.
        // Let's try requesting both if possible or default to mainnet for simplicity first.
        // Note: This request structure might need verification with Xverse docs.
        let response;
        try {
          response = await xverseProvider.request('getAccounts', { 
              purposes: ['payment'], 
              // network: { type: 'Mainnet' } // Or determine dynamically
          });
          logMessage(`Xverse getAccounts response: ${JSON.stringify(response)}`);
        } catch (err) {
           throw new Error(logMessage(`Xverse getAccounts failed: ${err instanceof Error ? err.message : String(err)}`));
        }
        
        if (response?.result?.addresses?.length) {
          // Prioritize mainnet address, then testnet, then first
          const mainnetAddress = response.result.addresses.find((addr: any) => addr.symbol === 'BTC' && addr.network === 'mainnet');
          const testnetAddress = response.result.addresses.find((addr: any) => addr.symbol === 'BTC' && addr.network === 'testnet');
          
          const addressInfo = mainnetAddress || testnetAddress || response.result.addresses[0]; 

          if (addressInfo?.address) {
            connectedAddress = addressInfo.address;
            connectedNetwork = addressInfo.network || (addressInfo.type === 'testnet' ? 'testnet' : 'mainnet');
            connectedPublicKey = addressInfo.publicKey; // Get public key from address info
            logMessage(`Using Xverse address: ${connectedAddress} on network: ${connectedNetwork}, PublicKey: ${connectedPublicKey}`);
            result = true;
          } else {
            throw new Error(logMessage('No suitable Bitcoin address returned from Xverse'));
          }
        } else {
          throw new Error(logMessage('No accounts returned from Xverse'));
        }
      } else if (type === 'magiceden') {
        if (!hasMagicEden) throw new Error(logMessage('Magic Eden wallet not detected'));
        const magicEden = (window as any).MagicEden;
        logMessage('Requesting connection to Magic Eden...');
        try {
          // Magic Eden API might differ - verify `connect`, `getAddress`, `getNetwork` 
          const connectResponse = await magicEden.connect(); // Assuming connect returns address or user info
          logMessage(`Magic Eden connection result: ${JSON.stringify(connectResponse)}`);
          
          if (connectResponse) { // Adjust based on actual response
            connectedAddress = await magicEden.getAddress();
            connectedPublicKey = await magicEden.getPublicKey(); // Get public key
            connectedNetwork = 'mainnet';
            logMessage(`Magic Eden address: ${connectedAddress} on network: ${connectedNetwork}, PublicKey: ${connectedPublicKey}`);
            result = true;
          } else {
            throw new Error(logMessage('Failed to connect to Magic Eden'));
          }
        } catch (err) {
          throw new Error(logMessage(`Magic Eden error: ${err instanceof Error ? err.message : String(err)}`));
        }
      }
      
      if (result && connectedAddress) {
         setAddress(connectedAddress);
         setPublicKey(connectedPublicKey); // Store public key
         setWalletType(type);
         setNetwork(connectedNetwork);
         setConnected(true);
         logMessage(`Successfully connected to ${type}. Address: ${connectedAddress}, Network: ${connectedNetwork}, PublicKey: ${connectedPublicKey}`);
      } else if (!result) {
        // Reset state if connection failed
        setConnected(false);
        setAddress(null);
        setPublicKey(null); // Reset public key
        setWalletType(null);
        setNetwork(null);
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error connecting to wallet';
      logMessage(`Connection error: ${errorMessage}`);
      setError(errorMessage);
      // Reset state on error
      setConnected(false);
      setAddress(null);
      setPublicKey(null); // Reset public key
      setWalletType(null);
      setNetwork(null);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [hasUnisat, hasXverse, hasMagicEden]);

  // Disconnect from wallet
  const disconnect = useCallback(async () => {
    logMessage(`Disconnecting from ${walletType || 'wallet'}...`);
    // Reset internal state immediately for responsiveness
    const previousWalletType = walletType;
    setConnected(false);
    setAddress(null);
    setPublicKey(null); // Reset public key
    setWalletType(null);
    setNetwork(null);
    setError(null);
    setLastConnectionAttempt(null);

    try {
      // Attempt wallet-specific disconnection if available
      if (previousWalletType === 'unisat' && hasUnisat && typeof (window as any).unisat?.disconnect === 'function') {
        await (window as any).unisat.disconnect();
        logMessage('UniSat disconnect called.');
      } else if (previousWalletType === 'xverse' && hasXverse && typeof (window as any).xverse?.bitcoin?.disconnect === 'function') {
        await (window as any).xverse.bitcoin.disconnect();
        logMessage('Xverse disconnect called.');
      } else if (previousWalletType === 'magiceden' && hasMagicEden && typeof (window as any).MagicEden?.disconnect === 'function') {
        await (window as any).MagicEden.disconnect();
        logMessage('Magic Eden disconnect called.');
      }
      logMessage('Disconnected successfully.');
    } catch (err) {
      logMessage(`Error during wallet disconnect method: ${err instanceof Error ? err.message : String(err)}`);
      // State is already reset, just log the error.
    }
  }, [walletType]); // Added walletType dependency

  // Sign PSBT
  const signPsbt = useCallback(async (psbtHex: string, options?: any): Promise<string> => {
    logMessage(`Attempting to sign PSBT with ${walletType}. Options: ${JSON.stringify(options)}`);
    if (!connected || !walletType) {
      throw new Error(logMessage('Cannot sign PSBT: Wallet not connected.'));
    }

    try {
      let signedPsbtHex: string;

      switch (walletType) {
        case 'unisat':
          if (!hasUnisat) throw new Error(logMessage('UniSat wallet not available.'));
          const unisat = (window as any).unisat;
          logMessage('Calling unisat.signPsbt with autoFinalized: false...');
          // Unisat often returns the signed PSBT hex directly
          // Explicitly set autoFinalized to false to let our code handle finalization
          signedPsbtHex = await unisat.signPsbt(psbtHex, {
            autoFinalized: false 
          });
          logMessage('UniSat signing successful (PSBT should contain signature only).');
          break;

        case 'xverse':
          if (!hasXverse || !(window as any).xverse?.bitcoin) throw new Error(logMessage('Xverse wallet not available.'));
          const xverseSigner = (window as any).xverse.bitcoin;
          logMessage('Calling Xverse signPsbt...');
          // Xverse signing might require different parameters or structure
          // Need to verify the exact method signature and response format from Xverse docs.
          // Example assumes a similar pattern but might need adjustment.
          const response = await xverseSigner.signPsbt({
              hex: psbtHex,
              // Pass options, potentially mapping them if names differ
              network: network, // Xverse might need network specified
              accountIndex: 0, // Xverse might need account index
              finalize: options?.autoFinalized ?? true,
              // ... other potential Xverse options
          });
          // Check response structure - it might be { result: { psbtHex: '...' } } or similar
          if (!response || !response.psbtHex) { // Adjust based on actual response structure
             throw new Error('Xverse signPsbt response did not contain expected psbtHex');
          }
          signedPsbtHex = response.psbtHex;
          logMessage('Xverse signing successful.');
          break;

        case 'magiceden':
          if (!hasMagicEden) throw new Error(logMessage('Magic Eden wallet not available.'));
          const magicEden = (window as any).MagicEden;
          logMessage('Calling MagicEden.signTransaction...'); // Method name might be different
          // Magic Eden API needs verification. Assuming `signTransaction` takes PSBT hex.
          // They might return the *final transaction hex* instead of the signed PSBT.
          // Adjust logic based on actual behavior.
          signedPsbtHex = await magicEden.signTransaction(psbtHex, {
            finalize: options?.autoFinalized ?? true // Assuming ME supports finalize option
          });
          logMessage('Magic Eden signing successful.');
          break;

        default:
          throw new Error(logMessage(`Signing not implemented for wallet type: ${walletType}`));
      }

      if (!signedPsbtHex) {
          throw new Error(logMessage('Signing failed: No signed PSBT hex returned from wallet.'));
      }
      
      logMessage(`Signed PSBT received (first 60): ${signedPsbtHex.substring(0, 60)}...`);
      return signedPsbtHex;

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error signing PSBT';
      logMessage(`Signing error: ${errorMsg}`);
      setError(errorMsg); // Set error state
      throw err; // Re-throw error to be caught by the calling component
    }
  }, [connected, walletType, address, publicKey, network, hasUnisat, hasXverse, hasMagicEden]); // Added dependencies

  // Get UTXOs
  const getUtxos = useCallback(async (): Promise<Utxo[]> => {
    logMessage(`Attempting to get UTXOs via backend API for ${walletType}...`);
    if (!connected || !walletType || !address) {
      throw new Error(logMessage('Cannot get UTXOs: Wallet not connected or address missing.'));
    }
    if (!apiService) {
        throw new Error(logMessage('Cannot get UTXOs: ApiService not available.'));
    }

    try {
      const utxos = await apiService.getAddressUtxos(network as string, address);
      
      logMessage(`Received ${utxos.length} UTXOs from backend API.`);
      return utxos;

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error getting UTXOs';
      logMessage(`Get UTXOs error: ${errorMsg}`);
      setError(errorMsg);
      throw err;
    }
  }, [connected, walletType, address, network, apiService]); // Add apiService to dependencies

  return {
    connect,
    disconnect,
    signPsbt,
    getUtxos,
    connected,
    address,
    publicKey,
    isConnecting,
    error,
    walletType,
    network,
    hasUnisat,
    hasXverse,
    hasMagicEden,
    lastConnectionAttempt
  };
};

export default useDirectWallet; 