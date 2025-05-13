import React from 'react';
import type { PsbtResponse } from '../../types';
import { ClipboardCopy, AlertTriangle } from 'lucide-react';

// Updated props interface
interface PsbtDisplayProps {
  psbtData: PsbtResponse;
  contentType?: string; // Optional for context
  fileName?: string;    // Optional for context
}

const PsbtDisplay: React.FC<PsbtDisplayProps> = ({ psbtData, contentType, fileName }) => {

  // Helper function for copying
  const copyToClipboard = (text: string) => {
     navigator.clipboard.writeText(text).then(() => {
        // Maybe add a visual confirmation later
        console.log('Copied to clipboard:', text);
        }).catch(err => {
        console.error('Failed to copy text: ', err);
        });
  };

  return (
    <div className="mt-6 p-4 border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-gray-800 rounded-md shadow-sm">
      <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-3">Reveal PSBT Generated</h3>
      <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-4">This is the PSBT for the **Reveal Transaction**. You must first create and broadcast a **Commit Transaction**.</p>

      {/* Conditionally display file info */}      
      {fileName && <p className="text-sm text-gray-600 dark:text-gray-400">File: {fileName}</p>}
      {contentType && <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Content Type: {contentType}</p>}

      {/* Details Needed for Commit Transaction */}      
      <div className="mb-4 p-3 border border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-gray-750 rounded">
          <h4 className="text-md font-semibold text-indigo-800 dark:text-indigo-300 mb-2">Step 1: Create Commit Transaction</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">Create a transaction that pays the following amount to the P2TR address derived from the reveal PSBT's input:</p>
          <p className="text-sm"><strong className="text-gray-700 dark:text-gray-300">Required Commit Output Value:</strong> {psbtData.commitTxOutputValue} sats</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">(This covers the final inscription postage + estimated reveal fee: {psbtData.revealFee} sats)</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">Once broadcasted, note the Commit Transaction's <strong className="font-semibold">TXID</strong> and the <strong className="font-semibold">VOUT</strong> (output index) of the payment.</p>
      </div>

      {/* Reveal PSBT Details */}      
      <div className="mb-4 p-3 border border-gray-300 dark:border-gray-600 rounded">
          <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-2">Step 2: Update and Sign Reveal PSBT</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">Update the Reveal PSBT below by replacing the dummy input TXID/VOUT with the actual Commit TXID/VOUT.</p>
          <div>
            <strong className="block text-gray-700 dark:text-gray-300 mb-1 text-sm">Reveal PSBT (Base64):</strong>
            <textarea readOnly value={psbtData.psbtBase64} rows={4} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 font-mono text-xs" />
            <button onClick={() => copyToClipboard(psbtData.psbtBase64)} className="mt-1 text-indigo-600 dark:text-indigo-400 hover:underline text-xs">Copy PSBT</button>
          </div>
          <div className="mt-3">
              <strong className="block text-gray-700 dark:text-gray-300 mb-1 text-sm">Required Signer Private Key (WIF):</strong>
              <div className="flex items-center p-2 border border-red-300 dark:border-red-600 bg-red-50 dark:bg-gray-900 rounded">
                <AlertTriangle size={16} className="text-red-600 dark:text-red-400 mr-2 flex-shrink-0"/>
                <span className="font-mono text-xs break-all text-red-800 dark:text-red-300 flex-grow">{psbtData.revealSignerPrivateKeyWif}</span>
                <button onClick={() => copyToClipboard(psbtData.revealSignerPrivateKeyWif)} className="ml-2 text-indigo-600 dark:text-indigo-400 hover:underline text-xs flex-shrink-0">Copy Key</button>
              </div>
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">Warning: Handle this private key with extreme care. Do not share it publicly.</p>
          </div>
           <p className="text-sm text-gray-700 dark:text-gray-300 mt-3">Sign the <strong className="font-semibold">updated</strong> PSBT using this private key.</p>
      </div>

      {/* Broadcast Step */}      
       <div className="p-3 border border-green-300 dark:border-green-600 bg-green-50 dark:bg-gray-750 rounded">
          <h4 className="text-md font-semibold text-green-800 dark:text-green-300 mb-2">Step 3: Broadcast Reveal Transaction</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">Broadcast the <strong className="font-semibold">signed Reveal Transaction</strong> to the Bitcoin network.</p>
      </div>
    </div>
  );
};

export default PsbtDisplay; 