import { useState, useEffect, useCallback } from 'react';
import { useLaserEyes } from '@omnisat/lasereyes';
import { UNISAT, XVERSE, MAGIC_EDEN } from '@omnisat/lasereyes-core';

// Wallet type for better type safety
export type WalletType = typeof UNISAT | typeof XVERSE | typeof MAGIC_EDEN;

export const useWalletConnection = () => {
  // Get the laser eyes hook data
  const laserEyesData = useLaserEyes();
  
  // Destructure needed properties
  const {
    connect: laserEyesConnect,
    disconnect: laserEyesDisconnect,
    connected, // Use original connected state again
    address,
    isConnecting,
    isInitializing,
    getInscriptions,
    provider,
    hasUnisat,
    hasXverse,
    hasMagicEden
  } = laserEyesData;

  // Add our own states for better error handling
  const [error, setError] = useState<string | null>(null);

  // Check for wallet extensions directly
  const [detectedWallets, setDetectedWallets] = useState<{
    unisat: boolean;
    xverse: boolean;
    magicEden: boolean;
  }>({
    unisat: false,
    xverse: false,
    magicEden: false
  });

  // Check wallet availability directly
  useEffect(() => {
    const checkWallets = () => {
      const detectUnisat = 'unisat' in window;
      const detectXverse = 'xverse' in window;
      const detectMagicEden = typeof (window as any).MagicEden === 'object' && (window as any).MagicEden !== null;

      setDetectedWallets({
        unisat: detectUnisat,
        xverse: detectXverse,
        magicEden: detectMagicEden
      });
    };
    
    checkWallets();
    const delayedCheck = setTimeout(checkWallets, 1000);
    
    return () => clearTimeout(delayedCheck);
  }, []);

  // Simplified connect function (reverting workaround)
  const connect = useCallback(async (walletType: WalletType) => {
    console.log(`Trying to connect to ${walletType}...`);
    setError(null);
    
    try {
      if (laserEyesConnect) {
        await laserEyesConnect(walletType);
        // Assuming connect throws on error or LaserEyes handles state internally
        // We might need to re-introduce state checks if laserEyesConnect 
        // doesn't reliably update the hook's 'connected' state or throw.
        return true; // Optimistically return true, relying on LaserEyes state
      } else {
        // Fallback logic remains the same
        console.log('LaserEyes connect unavailable, trying direct connection');
        if (walletType === UNISAT && 'unisat' in window) {
          // @ts-ignore
          const accounts = await window.unisat.requestAccounts();
          if (accounts && accounts.length > 0) {
            console.log('Connected to UniSat directly:', accounts[0]);
            return true;
          }
        }
        setError(`Could not connect to ${walletType}`);
        return false;
      }
    } catch (err) {
      console.error('Connect error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      return false;
    }
  }, [laserEyesConnect]); // Revert dependencies

  // Simplified disconnect function
  const disconnect = useCallback(async () => {
    try {
      if (laserEyesDisconnect) {
        await laserEyesDisconnect();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Disconnect error:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
      return false;
    }
  }, [laserEyesDisconnect]);

  return {
    // Original props from LaserEyes
    ...laserEyesData,
    
    // Override critical functions with our simplified wrapped versions
    connect,
    disconnect,
    // Return original states directly
    connected,
    isInitializing,
    
    // Additional state for better UX
    error,
    
    // Make wallet detection more reliable
    detectedWallets,
    hasAvailableWallets: detectedWallets.unisat || detectedWallets.xverse || detectedWallets.magicEden
  };
};

export default useWalletConnection; 