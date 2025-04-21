import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';

interface WalletConnectorProps {
  className?: string;
  buttonText?: string;
  showAddress?: boolean;
  compact?: boolean;
}

const WalletConnector: React.FC<WalletConnectorProps> = ({
  className = '',
  buttonText = 'Connect Wallet',
  showAddress = true,
  compact = false
}) => {
  const {
    connect,
    disconnect,
    connected,
    address,
    isConnecting,
    hasUnisat,
    hasXverse,
    hasMagicEden,
    error,
    walletType
  } = useWallet();
  
  const [isOpen, setIsOpen] = useState(false);
  
  // Toggle dropdown
  const toggleDropdown = () => {
    if (connected) {
      disconnect();
    } else {
      setIsOpen(!isOpen);
    }
  };
  
  // Connect to selected wallet
  const handleConnect = async (type: string) => {
    await connect(type as any);
    setIsOpen(false);
  };
  
  // Format address for display
  const formatAddress = (addr: string) => {
    if (!addr) return '';
    if (addr.length <= 12) return addr;
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 6)}`;
  };
  
  // Available wallets
  const wallets = [
    { name: 'UniSat', type: 'unisat', available: hasUnisat },
    { name: 'Xverse', type: 'xverse', available: hasXverse },
    { name: 'Magic Eden', type: 'magiceden', available: hasMagicEden }
  ].filter(w => w.available);
  
  return (
    <div className={`relative ${className}`}>
      {/* Main button */}
      <button
        onClick={toggleDropdown}
        disabled={isConnecting}
        className={`flex items-center justify-center rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors 
                   ${compact ? 'px-3 py-1 text-sm' : 'px-4 py-2'} 
                   ${isConnecting ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        {isConnecting ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Connecting...
          </>
        ) : connected ? (
          <div className="flex items-center">
            <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
            {showAddress && address ? formatAddress(address) : 'Disconnect'}
          </div>
        ) : (
          buttonText
        )}
      </button>
      
      {/* Dropdown menu */}
      {isOpen && !connected && (
        <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1" role="menu" aria-orientation="vertical">
            {wallets.length > 0 ? (
              wallets.map((wallet) => (
                <button
                  key={wallet.type}
                  onClick={() => handleConnect(wallet.type)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  role="menuitem"
                >
                  {wallet.name}
                </button>
              ))
            ) : (
              <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                No compatible wallets detected
              </div>
            )}
          </div>
          
          {error && (
            <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 text-xs text-red-500 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WalletConnector; 