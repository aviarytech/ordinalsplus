import React from 'react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Utxo } from '../../context/WalletContext';
import { truncateMiddle } from '../../utils/string';

/**
 * Props for PsbtFlow component.
 */
export interface PsbtFlowProps {
  flowState: string;
  flowError: string | null;
  commitTxid: string | null;
  revealTxid: string | null;
  confirmationStatus: string;
  selectedUtxos: Utxo[];
  onReset: () => void;
}

/**
 * PsbtFlow handles PSBT creation, signing, broadcasting, and status display for resource creation.
 */
const PsbtFlow: React.FC<PsbtFlowProps> = ({
  flowState,
  flowError,
  commitTxid,
  revealTxid,
  confirmationStatus,
  selectedUtxos,
  onReset,
}) => {
  let icon = null;
  let message = '';
  let details = '';

  switch (flowState) {
    case 'fetchingUtxos':
      icon = <Loader2 className="animate-spin h-5 w-5 text-blue-500" />;
      message = 'Fetching UTXOs...';
      break;
    case 'fetchingPsbts':
      icon = <Loader2 className="animate-spin h-5 w-5 text-blue-500" />;
      message = 'Requesting PSBTs from API...';
      break;
    case 'signingCommit':
      icon = <Loader2 className="animate-spin h-5 w-5 text-orange-500" />;
      message = 'Waiting for Commit signature from wallet...';
      break;
    case 'broadcastingCommit':
      icon = <Loader2 className="animate-spin h-5 w-5 text-purple-500" />;
      message = 'Broadcasting Commit Transaction...';
      if (commitTxid) details = `Commit TXID: ${truncateMiddle(commitTxid)}`;
      break;
    case 'signingReveal':
      icon = <Loader2 className="animate-spin h-5 w-5 text-orange-600" />;
      message = 'Creating and Finalizing Reveal Transaction...';
      break;
    case 'broadcastingReveal':
      icon = <Loader2 className="animate-spin h-5 w-5 text-purple-600" />;
      message = 'Broadcasting Reveal Transaction...';
      if (commitTxid) details = `Commit: ${truncateMiddle(commitTxid)}. `;
      if (revealTxid) details += `Reveal TXID: ${truncateMiddle(revealTxid)}`;
      break;
    case 'pollingStatus':
      icon = <Loader2 className="animate-spin h-5 w-5 text-gray-500" />;
      message = 'Polling for reveal confirmation...';
      if (commitTxid) details = `Commit: ${truncateMiddle(commitTxid)}. `;
      if (revealTxid) details += `Reveal: ${truncateMiddle(revealTxid)}. ${confirmationStatus}`;
      break;
    case 'confirmed':
      icon = <CheckCircle className="h-5 w-5 text-green-500" />;
      message = 'Inscription Confirmed!';
      if (commitTxid) details = `Commit: ${truncateMiddle(commitTxid)}. `;
      if (revealTxid) details += `Reveal: ${truncateMiddle(revealTxid)}. ${confirmationStatus}`;
      break;
    case 'failed':
      icon = <XCircle className="h-5 w-5 text-red-500" />;
      message = 'Inscription Failed';
      details = flowError || 'An unknown error occurred.';
      break;
    default:
      return null;
  }

  const relevantStates: string[] = [
    'fetchingPsbts',
    'signingCommit',
    'broadcastingCommit',
    'signingReveal',
    'broadcastingReveal',
    'pollingStatus',
  ];
  let utxoDisplay = null;
  if (selectedUtxos.length > 0 && relevantStates.includes(flowState)) {
    utxoDisplay = (
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-mono">
        Using {selectedUtxos.length} UTXO(s) for funding.
      </p>
    );
  }

  return (
    <div className="mt-6 p-4 border rounded-md bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <div className="flex items-center space-x-3">
        {icon}
        <span className={`font-medium ${flowState === 'failed' ? 'text-red-600 dark:text-red-400' : flowState === 'confirmed' ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
          {message}
        </span>
      </div>
      {details && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 break-all">
          {details}
        </p>
      )}
      {utxoDisplay}
      {flowState === 'failed' && (
        <button
          onClick={onReset}
          className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Reset Form
        </button>
      )}
    </div>
  );
};

export default PsbtFlow; 