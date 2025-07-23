import React from 'react';
import { Eye, Copy, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useResourceInscription } from './ResourceInscriptionWizard';
import { useWallet } from '../../context/WalletContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui';

interface DidPreviewProps {
  className?: string;
}

/**
 * DidPreview displays the DID that will be created based on the currently selected UTXO.
 * This component shows a preview of the DID before the inscription is actually created.
 */
const DidPreview: React.FC<DidPreviewProps> = ({ className }) => {
  const { state } = useResourceInscription();
  const { network: walletNetwork } = useWallet();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Helper function to get DID prefix based on network
  const getDidPrefix = (network: string | null): string => {
    if (network === 'testnet') {
      return 'did:btco:test';
    } else if (network === 'signet') {
      return 'did:btco:sig';
    }
    return 'did:btco';
  };

  // Generate the DID that will be created
  const generatePreviewDid = (): string | null => {
    if (!state.inscriptionUtxo) {
      return null;
    }

    const selectedUtxo = state.inscriptionUtxo;
    if (!selectedUtxo.satNumber) {
      return null;
    }

    const didPrefix = getDidPrefix(walletNetwork);
    return `${didPrefix}:${selectedUtxo.satNumber}`;
  };

  const previewDid = generatePreviewDid();

  // Copy DID to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        addToast('DID copied to clipboard', 'success');
      },
      (err) => {
        console.error('Could not copy text: ', err);
        addToast('Failed to copy DID', 'error');
      }
    );
  };

  // Open DID in explorer (if available)
  const openInExplorer = (did: string) => {
    // Navigate to the DID page in a new tab
    const didUrl = `/did/${encodeURIComponent(did)}`;
    window.open(didUrl, '_blank');
  };

  // Handle clicking on the example DID template
  const handleExampleDidClick = () => {
    const exampleDid = getDidPrefix(walletNetwork) + ':1234567890';
    // Navigate to the DID page
    navigate(`/did/${encodeURIComponent(exampleDid)}`);
  };

  if (!previewDid) {
    return (
      <div className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 ${className || ''}`}>
        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <Eye className="w-4 h-4" />
          <span className="text-sm font-medium">DID Preview</span>
        </div>
        <div className="mt-3">
          <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">
            Your DID will appear here once you select a UTXO:
          </p>
          <div className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-700 rounded-md p-3">
            <button
              onClick={handleExampleDidClick}
              className="text-sm text-gray-400 dark:text-gray-500 font-mono italic hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
              title="Click to search for example DIDs"
            >
              did:btco:{walletNetwork === 'testnet' ? 'test:' : walletNetwork === 'signet' ? 'sig:' : ''}[satoshi-number]
            </button>
          </div>
        </div>
        <p className="text-xs text-blue-500 dark:text-blue-400 mt-3">
          💡 The DID is created based on the satoshi number from your selected UTXO. Click the example above to explore existing DIDs!
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <Eye className="w-4 h-4" />
          <span className="text-sm font-medium">DID Preview</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(previewDid)}
            className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            title="Copy DID"
          >
            <Copy className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openInExplorer(previewDid)}
            className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            title="Open in Explorer"
          >
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </div>
      
      <div className="mt-3">
        <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">
          This DID will be created when the inscription is completed:
        </p>
        <div className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-700 rounded-md p-3">
          <code className="text-sm text-blue-800 dark:text-blue-200 font-mono break-all">
            {previewDid}
          </code>
        </div>
      </div>

      {state.inscriptionUtxo && (
        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
          <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">
            Based on UTXO:
          </p>
          <div className="text-xs text-blue-700 dark:text-blue-300 font-mono">
            <div>TXID: {state.inscriptionUtxo.txid}</div>
            <div>Output: {state.inscriptionUtxo.vout}</div>
            <div>Satoshi: {state.inscriptionUtxo.satNumber}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DidPreview; 