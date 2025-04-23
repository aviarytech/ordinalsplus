import React, { useState, useCallback, useEffect } from 'react';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
// @ts-ignore // Add ts-ignore if types are problematic after install
import { useFeeRates } from '../../hooks/useFeeRates';
import { calculateFee, formatFee } from '../../utils/fees';
import { truncateMiddle } from '../../utils/string';
import { useWallet, Utxo } from '../../context/WalletContext'; // Import Utxo
import { useApi } from '../../context/ApiContext';
// import { useNetwork } from '../../context/NetworkContext'; // Using network from wallet context now
import { Loader2, AlertCircle, CheckCircle, XCircle, UploadCloud } from 'lucide-react';
// --- Import library functions ---
import { prepareCommitTransactionPsbt } from 'ordinalsplus';
// --- Import missing types --- 
import { 
    // Already likely imported via local types below, remove if redundant
    // GenericInscriptionRequest, 
    // DidInscriptionRequest, 
    ResourceInscriptionRequest, 
    PsbtResponse
} from '../../types/index';

// Initialize bitcoinjs-lib ECC & ECPair
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// Define supported content types
const supportedContentTypes = [
  { mime: 'text/plain', label: 'Text', isText: true },
  { mime: 'application/json', label: 'JSON', isText: true },
  { mime: 'image/png', label: 'PNG Image', isText: false },
  { mime: 'image/jpeg', label: 'JPEG Image', isText: false },
  { mime: 'image/svg+xml', label: 'SVG Image', isText: false },
];

type FeeLevel = 'hour' | 'halfHour' | 'fastest';

// Constants
const MIN_DUST_LIMIT = 546; // Minimum dust limit in satoshis

const ResourceCreationForm: React.FC = () => {
  const [contentType, setContentType] = useState<string>(supportedContentTypes[0].mime);
  const [contentData, setContentData] = useState<string>(''); // Stores text data or base64 for files
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [selectedFeeLevel, setSelectedFeeLevel] = useState<FeeLevel>('halfHour');
  const [manualFeeRate, setManualFeeRate] = useState<string>('');
  const [useManualFee, setUseManualFee] = useState<boolean>(false);
  const [parentId, setParentId] = useState<string>('');
  const [revealPsbtBase64, setRevealPsbtBase64] = useState<string | null>(null);
  const [revealSignerWif, setRevealSignerWif] = useState<string | null>(null);
  const [commitOutputValueFromApi, setCommitOutputValueFromApi] = useState<number | null>(null);
  const [commitTxFee, setCommitTxFee] = useState<number | null>(null);

  // API and Wallet Hooks
  const { apiService } = useApi();
  // Destructure wallet context with renamed variables for clarity
  const { 
    connected: walletConnected, 
    address: walletAddress, 
    publicKey: walletPublicKey, // Renamed
    network: walletNetwork, // Renamed
    signPsbt, 
    getUtxos 
  } = useWallet();

  // Fee Rate Hook
  const { feeRates, loading: loadingFees, error: feeError, refreshFees } = useFeeRates();

  // PSBT & Transaction Flow State
  const [flowState, setFlowState] = useState<'idle' | 'fetchingPsbt' | 'preparingCommit' | 'signingCommit' | 'broadcastingCommit' | 'constructingReveal' | 'signingReveal' | 'broadcastingReveal' | 'pollingStatus' | 'confirmed' | 'failed'>('idle');
  const [flowError, setFlowError] = useState<string | null>(null);
  const [unsignedCommitPsbtHex, setUnsignedCommitPsbtHex] = useState<string | null>(null);
  const [signedCommitPsbtHex, setSignedCommitPsbtHex] = useState<string | null>(null);
  const [unsignedRevealPsbtHex, setUnsignedRevealPsbtHex] = useState<string | null>(null);
  const [signedRevealPsbtHex, setSignedRevealPsbtHex] = useState<string | null>(null);
  const [commitTxid, setCommitTxid] = useState<string | null>(null);
  const [commitVout, setCommitVout] = useState<number | null>(null); // Vout for reveal input
  const [revealTxid, setRevealTxid] = useState<string | null>(null);
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [confirmationStatus, setConfirmationStatus] = useState<string>('');
  const [commitUtxosUsed, setCommitUtxosUsed] = useState<Utxo[]>([]);

  // Derived State
  const isTextContent = supportedContentTypes.find(ct => ct.mime === contentType)?.isText ?? true;
  const networkConfig = walletNetwork === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;

  const getFeeRate = useCallback((): number | undefined => {
    if (useManualFee) {
      const rate = parseInt(manualFeeRate, 10);
      return isNaN(rate) ? undefined : rate;
    } else {
      const levelKey = `${selectedFeeLevel}Fee` as keyof typeof feeRates;
      return feeRates?.[levelKey];
    }
  }, [useManualFee, manualFeeRate, feeRates, selectedFeeLevel]);

  const feeRate = getFeeRate();

  // --- Handlers ---
  const handleContentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setContentType(e.target.value);
    setContentData('');
    setSelectedFile(null);
    setFilePreview(null);
    setFlowState('idle');
    setFlowError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFlowState('idle');
    setFlowError(null);
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setContentData(base64String);
        setFilePreview(file.type.startsWith('image/') ? base64String : null);
      };
      reader.onerror = () => {
        setFlowError('Error reading file.');
        setSelectedFile(null);
        setContentData('');
        setFilePreview(null);
      }
      reader.readAsDataURL(file);
    } else {
      setSelectedFile(null);
      setContentData('');
      setFilePreview(null);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContentData(e.target.value);
    setFlowState('idle');
    setFlowError(null);
  };

  const handleFeeLevelSelect = (level: FeeLevel) => {
    setSelectedFeeLevel(level);
    setUseManualFee(false);
    setManualFeeRate('');
    setFlowState('idle');
  };

  const handleManualFeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setManualFeeRate(value);
    setUseManualFee(true);
    setFlowState('idle');
  };

  // --- Main Submission Logic ---
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("[Submit Refactor Test] handleSubmit triggered.");
    console.log("[Submit] handleSubmit triggered.");
    setFlowError(null);
    setRevealPsbtBase64(null);
    setRevealSignerWif(null);
    setCommitOutputValueFromApi(null);
    setUnsignedCommitPsbtHex(null);
    setSignedCommitPsbtHex(null);
    setUnsignedRevealPsbtHex(null);
    setSignedRevealPsbtHex(null);
    setCommitTxid(null);
    setCommitVout(null);
    setRevealTxid(null);
    setCommitTxFee(null);
    setCommitUtxosUsed([]);
    setConfirmationStatus('');
    if (pollingIntervalId) clearInterval(pollingIntervalId);
    setPollingIntervalId(null);
    setFlowState('idle');

    // Validation checks
    if (!walletConnected || !walletAddress || !walletPublicKey) {
      setFlowError('Please connect your wallet and ensure public key is available.');
      setFlowState('failed');
      return;
    }
    if (!contentData) {
      setFlowError('Please provide content to inscribe.');
      setFlowState('failed');
      return;
    }
    const currentFeeRate = getFeeRate();
    if (currentFeeRate === undefined || currentFeeRate <= 0) {
      setFlowError('Please select or enter a valid positive fee rate.');
      setFlowState('failed');
      return;
    }
    if (!apiService) {
      setFlowError('API service is not available.');
      setFlowState('failed');
      return;
    }
    const currentNetwork = walletNetwork;
    if (!currentNetwork) {
        setFlowError('Wallet network not determined.');
        setFlowState('failed');
        return;
    }

    // --- Content Preparation and Base64 Encoding ---
    let contentBase64: string;
    if (isTextContent) {
        // For text types, directly encode the string data
        contentBase64 = Buffer.from(contentData, 'utf8').toString('base64');
    } else if (selectedFile) {
        // For files, extract the base64 part from the data URL
        const base64Parts = contentData.split(',');
        if (base64Parts.length !== 2) {
            setFlowError('Invalid file data format (expected data URL).');
            setFlowState('failed');
            return;
        }
        contentBase64 = base64Parts[1];
    } else {
        setFlowError('No content data available for inscription.');
        setFlowState('failed');
        return;
    }
    // TODO: Handle parentId and metadata if ResourceInscriptionRequest is used
    // This part assumes GenericInscriptionRequest for now
    console.log("[Submit] Content prepared (Base64, first 100 chars):", contentBase64.substring(0, 100));

    // --- Use ApiService to get PSBT/Commit Details ---
    // Replace direct fetch with apiService call
    console.log(`[Submit] Calling apiService.createResourceInscription for network: ${currentNetwork}`);
    setFlowState('fetchingPsbt');

    try {
      // Construct the request for the API service method
      const createRequest: ResourceInscriptionRequest = {
          contentType,
          contentBase64,
          feeRate: currentFeeRate,
          recipientAddress: walletAddress,
          // parentDid: parentId || undefined, // Add parentId if/when implemented
          // metadata: {}, // Add metadata if/when implemented
      };

      // Call the appropriate apiService method, passing the network type
      // Using createResourceInscription as an example, adjust if needed (e.g., createGenericInscription)
      const response: PsbtResponse = await apiService.createResourceInscription(currentNetwork, createRequest);

      console.log('[Submit] Received PsbtResponse from API:', response);
      
      // Store details needed for commit/reveal from the response
      setUnsignedCommitPsbtHex(response.psbtBase64); // Assuming API returns commit PSBT here
      setCommitOutputValueFromApi(response.commitTxOutputValue);
      setRevealPsbtBase64(response.psbtBase64); // TODO: API needs to return Reveal PSBT separately
      setRevealSignerWif(response.revealSignerPrivateKeyWif); // TODO: API needs to return Reveal WIF separately
      setCommitTxFee(response.revealFee); // Assuming this is commit fee? API naming unclear.

      // --- Proceed to Prepare Commit Transaction (using data from API response) ---
      if (!response.psbtBase64) { // Check if commit PSBT was returned
           throw new Error('API did not return the required commit PSBT.');
      }
      // Continue with signing commit PSBT
      await handleSignAndBroadcastCommit(response.psbtBase64);
      

    } catch (error) {
      console.error('[Submit] Error during inscription creation API call:', error);
      setFlowError(error instanceof Error ? error.message : 'Failed to get inscription details from API');
      setFlowState('failed');
    }
  };

  // --- Helper Functions (Commit/Reveal Flow) ---

  // Placeholder - this function might be redundant if API provides commit PSBT directly
  const handlePrepareCommitPsbt = async (commitOutputValue: number, currentFeeRate: number) => {
    // ... (existing logic might be removed or adapted based on API response) ...
    console.warn("[handlePrepareCommitPsbt] This function might be redundant if API provides commit PSBT.");
  };

  const handleSignAndBroadcastCommit = async (unsignedCommitBase64: string) => {
    // ... (existing signing logic using signPsbt) ...
    console.log("[SignCommit] Attempting to sign commit PSBT...");
    setFlowState('signingCommit');
    try {
      if (!signPsbt) throw new Error("signPsbt function not available from wallet.");
      const signedCommitBase64 = await signPsbt(unsignedCommitBase64);
      setSignedCommitPsbtHex(signedCommitBase64);
      console.log("[SignCommit] Commit PSBT signed successfully.");

      // --- Proceed to Broadcast Commit ---
      await handleBroadcastCommit(signedCommitBase64);

    } catch (error) {
      console.error('[SignCommit] Error signing commit PSBT:', error);
      setFlowError(error instanceof Error ? error.message : 'Failed to sign commit transaction');
      setFlowState('failed');
    }
  };

  const handleBroadcastCommit = async (signedCommitBase64: string) => {
    console.log("[BroadcastCommit] Broadcasting commit transaction...");
    setFlowState('broadcastingCommit');
    try {
      if (!apiService) throw new Error("API Service not available");
      const currentNetwork = walletNetwork;
      if (!currentNetwork) throw new Error("Wallet network not determined");
      
      // Convert Base64 PSBT to Hex for broadcasting if needed by API
      // const signedCommitHex = bitcoin.Psbt.fromBase64(signedCommitBase64).extractTransaction().toHex();
      // Assuming API accepts Base64 PSBT for broadcast endpoint or internally handles hex conversion
      // For now, let's assume apiService.broadcastTransaction needs the *final tx hex*
      const finalCommitTx = bitcoin.Psbt.fromBase64(signedCommitBase64).extractTransaction();
      const finalCommitTxHex = finalCommitTx.toHex();

      const broadcastResponse = await apiService.broadcastTransaction(currentNetwork, finalCommitTxHex);
      const receivedCommitTxid = broadcastResponse.txid;
      setCommitTxid(receivedCommitTxid);
      console.log(`[BroadcastCommit] Commit TX broadcast successful. TXID: ${receivedCommitTxid}`);

      // --- Determine Commit Vout (Needed for Reveal) ---
      // Find the P2TR output address matching the recipient (our wallet address)
      const outputs = finalCommitTx.outs;
      let foundVout = -1;
      for (let i = 0; i < outputs.length; i++) {
          try {
              const outputAddress = bitcoin.address.fromOutputScript(outputs[i].script, networkConfig);
              if (outputAddress === walletAddress) {
                  foundVout = i;
                  break;
              }
          } catch (e) { /* Ignore outputs that aren't addresses */ }
      }
      if (foundVout === -1) {
          throw new Error("Could not find commit transaction output VOUT for the recipient address.");
      }
      setCommitVout(foundVout);
      console.log(`[BroadcastCommit] Determined commit Vout: ${foundVout}`);

      // --- Proceed to Reveal ---
      // TODO: Need the reveal PSBT and WIF from the initial API response!
      // Assuming revealPsbtBase64 and revealSignerWif were set correctly earlier
      if (!revealPsbtBase64 || !revealSignerWif) {
          throw new Error("Missing reveal PSBT or signer WIF from API response.");
      }
      await handleConstructAndSignReveal(receivedCommitTxid, foundVout, revealPsbtBase64, revealSignerWif);

    } catch (error) {
      console.error('[BroadcastCommit] Error broadcasting commit TX:', error);
      setFlowError(error instanceof Error ? error.message : 'Failed to broadcast commit transaction');
      setFlowState('failed');
    }
  };

  // Updated to accept reveal PSBT/WIF from API response
  const handleConstructAndSignReveal = async (confirmedCommitTxid: string, confirmedCommitVout: number, revealPsbtBase64: string, revealSignerWif: string) => {
    console.log("[ConstructReveal] Constructing and signing reveal transaction...");
    setFlowState('constructingReveal');
    try {
      // TODO: The API should ideally provide the *unsigned* reveal PSBT.
      // The frontend should ONLY sign it.
      // Assuming for now revealPsbtBase64 IS the unsigned reveal PSBT.
      
      // The reveal signing key comes from the API
      const revealKeyPair = ECPair.fromWIF(revealSignerWif, networkConfig);
      const revealPublicKeyBuffer = Buffer.from(revealKeyPair.publicKey); // Ensure public key is Buffer

      // Create a Signer object compatible with bitcoinjs-lib
      const taprootSigner: bitcoin.Signer = {
        publicKey: revealPublicKeyBuffer,
        signSchnorr: (hash: Buffer): Buffer => {
          // ECPair signSchnorr expects Uint8Array, returns Uint8Array
          const hashUint8 = Uint8Array.from(hash);
          const sigUint8 = revealKeyPair.signSchnorr(hashUint8);
          return Buffer.from(sigUint8); // Convert back to Buffer
        },
        // Provide dummy sign method if needed, though not used for taproot script path
        sign: (hash: Buffer): Buffer => { 
          throw new Error("ECDSA sign called on taprootSigner");
        },
      };

      // Deserialize the unsigned reveal PSBT received from the API
      const revealPsbt = bitcoin.Psbt.fromBase64(revealPsbtBase64, { network: networkConfig });
      
      // Sign the reveal PSBT's input (usually index 0) using the compatible Signer
      revealPsbt.signInput(0, taprootSigner); // Pass the Signer object
      revealPsbt.finalizeInput(0); // Finalize the input

      const signedRevealBase64 = revealPsbt.toBase64();
      setSignedRevealPsbtHex(signedRevealBase64); // Store signed reveal PSBT
      console.log("[ConstructReveal] Reveal PSBT signed locally.");

      // --- Proceed to Broadcast Reveal ---
      await handleBroadcastReveal(signedRevealBase64);

    } catch (error) {
      console.error('[ConstructReveal] Error constructing/signing reveal TX:', error);
      setFlowError(error instanceof Error ? error.message : 'Failed to construct or sign reveal transaction');
      setFlowState('failed');
    }
  };

  const handleBroadcastReveal = async (signedRevealBase64: string) => {
    console.log("[BroadcastReveal] Broadcasting reveal transaction...");
    setFlowState('broadcastingReveal');
    try {
      if (!apiService) throw new Error("API Service not available");
      const currentNetwork = walletNetwork;
      if (!currentNetwork) throw new Error("Wallet network not determined");

      // Assuming apiService.broadcastTransaction needs the final tx hex
      const finalRevealTxHex = bitcoin.Psbt.fromBase64(signedRevealBase64).extractTransaction().toHex();

      const broadcastResponse = await apiService.broadcastTransaction(currentNetwork, finalRevealTxHex);
      setRevealTxid(broadcastResponse.txid);
      console.log(`[BroadcastReveal] Reveal TX broadcast successful. TXID: ${broadcastResponse.txid}`);

      // --- Start Polling --- 
      setFlowState('pollingStatus');
      setConfirmationStatus('Waiting for confirmation...');
      pollTransactionStatus(broadcastResponse.txid);

    } catch (error) {
      console.error('[BroadcastReveal] Error broadcasting reveal TX:', error);
      setFlowError(error instanceof Error ? error.message : 'Failed to broadcast reveal transaction');
      setFlowState('failed');
    }
  };

  const pollTransactionStatus = (txid: string) => {
    console.log(`[Polling] Starting polling for TXID: ${txid}`);
    // Clear any existing interval
    if (pollingIntervalId) clearInterval(pollingIntervalId);

    const interval = setInterval(async () => {
      try {
        if (!apiService) throw new Error("API Service not available");
        const currentNetwork = walletNetwork;
        if (!currentNetwork) throw new Error("Wallet network not determined");
        
        console.log(`[Polling] Checking status for TXID: ${txid} on network ${currentNetwork}`);
        const response = await apiService.getTransactionStatus(currentNetwork, txid);

        if (response.status === 'confirmed') {
          console.log(`[Polling] TXID ${txid} confirmed!`);
          setConfirmationStatus(`Confirmed! Inscription ID (usually reveal_txid:0): ${txid}:0`);
          setFlowState('confirmed');
          clearInterval(interval);
          setPollingIntervalId(null);
        } else if (response.status === 'failed') {
           console.error(`[Polling] TXID ${txid} failed.`);
           setFlowError('Reveal transaction failed to confirm or was rejected.');
           setFlowState('failed');
           clearInterval(interval);
           setPollingIntervalId(null);
        } else if (response.status === 'not_found') {
            console.warn(`[Polling] TXID ${txid} not found yet...`);
            setConfirmationStatus('Transaction not found yet, still polling...');
        } else { // pending
            console.log(`[Polling] TXID ${txid} still pending...`);
            setConfirmationStatus('Transaction pending confirmation...');
        }
      } catch (error) {
        console.error(`[Polling] Error polling status for ${txid}:`, error);
        // Optional: Stop polling on error or just log and continue?
        // setFlowError('Error checking transaction status.');
        // setFlowState('failed');
        // clearInterval(interval);
        // setPollingIntervalId(null);
      }
    }, 10000); // Poll every 10 seconds

    setPollingIntervalId(interval);
  };

  // --- Utility functions within component ---

  const selectUtxos = (utxos: Utxo[], amount: number, fee: number): Utxo[] => {
      let selected: Utxo[] = [];
      let totalValue = 0;
      const targetAmount = amount + fee;

      // Simple selection strategy: sort largest first and pick until amount is met
      const sortedUtxos = [...utxos].sort((a, b) => b.value - a.value);

      for (const utxo of sortedUtxos) {
          selected.push(utxo);
          totalValue += utxo.value;
          if (totalValue >= targetAmount) {
              break;
          }
      }

      if (totalValue < targetAmount) {
          throw new Error(`Insufficient funds. Required: ${targetAmount} sats, Available: ${totalValue} sats`);
      }
      return selected;
  };

  const getTaprootOutputScript = (publicKeyHex: string): Buffer => {
      const internalPubKey = Buffer.from(publicKeyHex, 'hex').slice(1); // Remove parity byte for x-only pubkey
      const { output } = bitcoin.payments.p2tr({ internalPubkey: internalPubKey, network: networkConfig });
      if (!output) throw new Error("Failed to generate P2TR output script");
      return output;
  };

  // Cleanup polling on unmount or completion
  useEffect(() => {
    return () => {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
    };
  }, [pollingIntervalId]);

  // --- Render Functions ---

  const renderContentInput = () => {
    if (isTextContent) {
      return (
        <div>
          <label htmlFor="contentData" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
          <textarea
            id="contentData"
            rows={6}
            value={contentData}
            onChange={handleTextChange}
            placeholder={contentType === 'application/json' ? 'Enter valid JSON data...' : 'Enter text content...'}
            disabled={flowState !== 'idle'}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
          />
        </div>
      );
    } else {
      return (
        <div>
          <label htmlFor="fileUpload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Upload File</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600 dark:text-gray-400">
                <label
                  htmlFor="fileUpload"
                  className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                >
                  <span>Upload a file</span>
                  <input
                    id="fileUpload"
                    name="fileUpload"
                    type="file"
                    accept={contentType}
                    onChange={handleFileChange}
                    disabled={flowState !== 'idle'}
                    className="sr-only"
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                 {contentType.split('/')[1].toUpperCase()} file
              </p>
            </div>
          </div>
          {selectedFile && (
            <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
            </div>
          )}
          {filePreview && contentType.startsWith('image/') && (
            <div className="mt-3">
                <img src={filePreview} alt="File preview" className="max-h-40 rounded border border-gray-300 dark:border-gray-600" />
            </div>
          )}
        </div>
      );
    }
  };

  const renderFeeSelector = () => (
    <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Transaction Fee Rate (sats/vB)</label>
        {loadingFees && <p className="text-sm text-gray-500 dark:text-gray-400">Loading fee estimates...</p>}
        {feeError && <p className="text-sm text-red-600 dark:text-red-400">Error loading fees: {feeError}</p>}
        {!loadingFees && feeRates && (
            <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0 mb-2">
                {(['fastest', 'halfHour', 'hour'] as FeeLevel[]).map(level => (
                    <button
                        key={level}
                        type="button"
                        onClick={() => handleFeeLevelSelect(level)}
                        disabled={flowState !== 'idle'}
                        className={`flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed
                            ${!useManualFee && selectedFeeLevel === level
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                         <span className="font-medium capitalize">{level === 'halfHour' ? '30 Min' : level === 'fastest' ? 'Fastest' : '1 Hour'}</span>
                         <br />
                         <span className="text-xs">({formatFee(feeRates[`${level}Fee`])} sats/vB)</span>
                    </button>
                ))}
            </div>
        )}
        <div className="flex items-center space-x-2">
            <input
                type="text"
                pattern="\\d*"
                placeholder="Manual sats/vB"
                value={manualFeeRate}
                onChange={handleManualFeeChange}
                disabled={flowState !== 'idle'}
                className={`flex-grow p-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50
                    ${useManualFee ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-300 dark:border-gray-600'}
                `}
            />
            <button
                type="button"
                onClick={refreshFees}
                disabled={loadingFees || flowState !== 'idle'}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                title="Refresh fee estimates"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${loadingFees ? 'animate-spin' : ''}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
            </button>
        </div>
    </div>
  );

  const renderStatusDisplay = () => {
      let icon = null;
      let message = '';
      let details = '';

      switch (flowState) {
          case 'fetchingPsbt': // Still used for initial API call
              icon = <Loader2 className="animate-spin h-5 w-5 text-blue-500" />;
              message = 'Fetching commit details (temporary)...';
              break;
          case 'preparingCommit': // Updated state name
              icon = <Loader2 className="animate-spin h-5 w-5 text-blue-500" />;
              message = 'Preparing Commit Transaction (Library)...';
              break;
          // Keep other states as they are for now
          case 'signingCommit':
              icon = <Loader2 className="animate-spin h-5 w-5 text-orange-500" />;
              message = 'Waiting for Commit signature from wallet...';
              break;
          case 'broadcastingCommit':
              icon = <Loader2 className="animate-spin h-5 w-5 text-purple-500" />;
              message = 'Broadcasting Commit Transaction...';
              if (commitTxid) details = `Commit TXID: ${truncateMiddle(commitTxid)}`;
              break;
          case 'constructingReveal':
              icon = <Loader2 className="animate-spin h-5 w-5 text-blue-500" />;
              message = 'Constructing Reveal Transaction (Old Flow)...'; // Updated message
              if (commitTxid) details = `Using Commit TX: ${truncateMiddle(commitTxid)}`;
              break;
          case 'signingReveal': // May not be explicitly hit if old flow signs+broadcasts together
              icon = <Loader2 className="animate-spin h-5 w-5 text-orange-500" />;
              message = 'Signing Reveal Transaction (Old Flow)...';
              break;
          case 'broadcastingReveal':
              icon = <Loader2 className="animate-spin h-5 w-5 text-purple-500" />;
              message = 'Broadcasting Reveal Transaction (Old Flow)...';
               if (revealTxid) details = `Reveal TXID: ${truncateMiddle(revealTxid)}`;
              break;
          case 'pollingStatus':
              icon = <Loader2 className="animate-spin h-5 w-5 text-gray-500" />;
              message = 'Polling for confirmation...';
              if (revealTxid) details = `Reveal TX: ${truncateMiddle(revealTxid)}. ${confirmationStatus}`;
              break;
          case 'confirmed':
              icon = <CheckCircle className="h-5 w-5 text-green-500" />;
              message = 'Inscription Confirmed!';
              if (revealTxid) details = `Reveal TX: ${truncateMiddle(revealTxid)}. ${confirmationStatus}`;
              break;
          case 'failed':
              icon = <XCircle className="h-5 w-5 text-red-500" />;
              message = 'Inscription Failed';
              details = flowError || 'An unknown error occurred.';
              break;
          default:
              return null; // Idle state
      }

      // Updated UTXO display logic
      let utxoDisplay = null;
      // Show UTXOs once prepared by library, before signing
      if ((flowState === 'preparingCommit' || flowState === 'signingCommit' || flowState === 'broadcastingCommit') && commitUtxosUsed.length > 0) {
          utxoDisplay = (
              <details open={flowState === 'signingCommit'} className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <summary className="cursor-pointer font-medium">Commit Details</summary>
                  <ul className="list-disc pl-5 mt-1 space-y-1 font-mono break-all">
                      <li>Fee: {commitTxFee ? `${commitTxFee} sats` : 'Calculating...'}</li>
                      <li>UTXOs Used ({commitUtxosUsed.length}):</li>
                      {commitUtxosUsed.map(utxo => (
                          <li key={`${utxo.txid}:${utxo.vout}`} className="pl-4">
                              {truncateMiddle(utxo.txid)}:{utxo.vout} ({utxo.value} sats)
                          </li>
                      ))}
                  </ul>
              </details>
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
                        onClick={() => setFlowState('idle')} 
                        className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                        Reset Form
                    </button>
                 )}
            </div>
        );
  };

  // --- Final Render ---
  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-white">Create New Resource Inscription</h2>

      {/* Wallet Connection Status */}
      {!walletConnected && (
          <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-md text-yellow-800 dark:text-yellow-200">
              <AlertCircle className="inline-block mr-2 h-5 w-5" />
              Please connect your wallet to proceed.
          </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Content Type Selector */}
        <div>
          <label htmlFor="contentType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content Type</label>
          <select
            id="contentType"
            value={contentType}
            onChange={handleContentTypeChange}
            disabled={flowState !== 'idle'}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {supportedContentTypes.map(ct => (
              <option key={ct.mime} value={ct.mime}>{ct.label} ({ct.mime})</option>
            ))}
          </select>
        </div>

        {/* Content Input */}
        {renderContentInput()}

        {/* Parent ID Input (Optional) */}
        <div>
          <label htmlFor="parentId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Parent Resource ID (Optional)
          </label>
          <input
            type="text"
            id="parentId"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            placeholder="did:btco:<sat>/<index>"
            disabled={flowState !== 'idle'}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Link this resource to an existing parent DID.</p>
        </div>

        {/* Fee Selector */}
        {renderFeeSelector()}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!walletConnected || flowState !== 'idle' || !contentData || feeRate === undefined}
          className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {flowState !== 'idle' ? (
            <>
              <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
              Processing...
            </>
          ) : (
            'Create Inscription'
          )}
        </button>

        {/* Status Display */}
        {flowState !== 'idle' && renderStatusDisplay()}

      </form>
    </div>
  );
};

export default ResourceCreationForm;
