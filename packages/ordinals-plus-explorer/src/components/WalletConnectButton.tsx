import React, { useState, useEffect } from 'react';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { UNISAT, XVERSE, MAGIC_EDEN } from '@omnisat/lasereyes-core';

interface WalletConnectButtonProps {
  className?: string;
  walletType?: 'unisat' | 'xverse' | 'magiceden';
  label?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  initTimeoutMs?: number;
}

const WalletConnectButton: React.FC<WalletConnectButtonProps> = ({
  className = '',
  walletType = 'unisat',
  label = 'Connect Wallet',
  onSuccess,
  onError,
  initTimeoutMs = 5000
}) => {
  const [initTimeoutExpired, setInitTimeoutExpired] = useState(false);
  
  const {
    connect,
    disconnect,
    connected,
    isInitializing,
    error
  } = useWalletConnection();

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    if (isInitializing && !initTimeoutExpired) {
      timeoutId = setTimeout(() => {
        console.log(`Wallet initialization timeout expired after ${initTimeoutMs}ms`);
        setInitTimeoutExpired(true);
      }, initTimeoutMs);
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isInitializing, initTimeoutExpired, initTimeoutMs]);

  // Map wallet type string to constant
  const getWalletConstant = () => {
    switch (walletType) {
      case 'unisat':
        return UNISAT;
      case 'xverse':
        return XVERSE;
      case 'magiceden':
        return MAGIC_EDEN;
      default:
        return UNISAT;
    }
  };

  const handleConnect = async () => {
    try {
      const success = await connect(getWalletConstant());
      
      if (success) {
        console.log(`Connected to ${walletType} wallet`);
        onSuccess?.();
      } else {
        const errorMsg = `Failed to connect to ${walletType} wallet`;
        console.error(errorMsg);
        onError?.(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error connecting wallet';
      console.error('Wallet connection error:', errorMsg);
      onError?.(errorMsg);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    console.log('Disconnected from wallet');
  };

  // Don't show loading state if we're past the timeout or already connected
  // This is a workaround for LaserEyes issue where isInitializing remains true even after connection
  const isEffectivelyInitializing = isInitializing && !connected && !initTimeoutExpired;

  return (
    <button
      className={`px-4 py-2 rounded transition-colors ${
        connected
          ? 'bg-red-500 hover:bg-red-600 text-white'
          : isEffectivelyInitializing
          ? 'bg-gray-400 text-white cursor-wait'
          : 'bg-blue-500 hover:bg-blue-600 text-white'
      } ${className}`}
      onClick={connected ? handleDisconnect : handleConnect}
      disabled={isEffectivelyInitializing}
    >
      {connected
        ? 'Disconnect'
        : isEffectivelyInitializing
        ? 'Initializing...'
        : label}
    </button>
  );
};

export default WalletConnectButton; 