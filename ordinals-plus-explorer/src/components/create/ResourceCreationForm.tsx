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

    // --- Call /api/inscriptions/create ONLY to get commit details (TEMPORARY) ---
    console.log("[Submit] Fetching commit details (TEMPORARY) via API...");
    setFlowState('fetchingPsbt'); // Keep state name for now

    try {
      const apiUrl = apiService.getConfig().baseUrl;
      const endpoint = `${apiUrl}/api/inscriptions/create`;
      const createRequest: ResourceInscriptionRequest = {
          contentType,
          contentBase64,
          feeRate: currentFeeRate,
          recipientAddress: walletAddress,
      };

      console.log(`[Submit] Calling POST ${endpoint} for details with payload:`, createRequest);
      const apiResponse = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createRequest),
      });

      if (!apiResponse.ok) {
          let errorBody = 'Unknown API error';
          try { errorBody = await apiResponse.text(); } catch(e) {}
          throw new Error(`API Error ${apiResponse.status}: ${errorBody}`);
      }

      const responseData: PsbtResponse = await apiResponse.json();
      const { commitTxOutputValue, revealFee, psbtBase64, revealSignerPrivateKeyWif } = responseData;

      // --- Store TEMPORARY values needed for later steps --- 
      setCommitOutputValueFromApi(commitTxOutputValue);
      setRevealPsbtBase64(psbtBase64); // Keep for reveal step for now
      setRevealSignerWif(revealSignerPrivateKeyWif); // Keep for reveal step for now

      console.log(`[Submit] Received commit details: OutputValue=${commitTxOutputValue}, RevealFee=${revealFee}`);

      // --- Proceed to Prepare Commit using library --- 
      // CHANGED: Call new handler function
      await handlePrepareCommitPsbt(commitTxOutputValue, currentFeeRate);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get commit details from API';
      console.error('[Submit] Error during fetching commit details:', errorMsg, err);
      setFlowError(`Fetch Details Error: ${errorMsg}`);
      setFlowState('failed');
    }
  };

  // --- STEP 1: Prepare Commit PSBT using Library ---
  const handlePrepareCommitPsbt = async (commitOutputValue: number, currentFeeRate: number) => {
    setFlowState('preparingCommit'); // Use new state name
    console.log(`[Commit Step 1] Preparing Commit PSBT via library. Required output value: ${commitOutputValue} sats, FeeRate: ${currentFeeRate} sat/vB`);

    if (!walletAddress || !walletPublicKey) {
      setFlowError('Wallet address or public key missing.');
      setFlowState('failed');
      return;
    }
    if (commitOutputValue <= 0) {
      setFlowError(`Invalid commit output value for library: ${commitOutputValue}`);
      setFlowState('failed');
      return;
    }

    try {
      console.log('[Commit Step 1] Fetching UTXOs...');
      const availableUtxos = await getUtxos();
      console.log(`[Commit Step 1] Found ${availableUtxos.length} UTXOs.`);
      if (availableUtxos.length === 0) {
        setFlowError('No UTXOs available to fund the transaction.');
        setFlowState('failed');
        return;
      }

      // --- Call Library Function --- 
      const { psbt, selectedUtxos, commitFee } = await prepareCommitTransactionPsbt(
          availableUtxos,
          commitOutputValue,
          walletPublicKey, // Use wallet's public key for P2TR commit output
          walletAddress, // Change address
          networkConfig,
          currentFeeRate
      );

      console.log(`[Commit Step 1] Library prepared unsigned commit PSBT. Fee: ${commitFee} sats`);
      setCommitUtxosUsed(selectedUtxos);
      setCommitTxFee(commitFee); // Store the calculated fee

      const unsignedHex = psbt.toHex();
      console.log("[Commit Step 1] Library PSBT (hex):", unsignedHex.substring(0, 100) + "...");
      setUnsignedCommitPsbtHex(unsignedHex);
      
      // --- Proceed to Sign and Broadcast --- 
      const unsignedBase64 = psbt.toBase64();
      await handleSignAndBroadcastCommit(unsignedBase64); // Pass base64 to next step

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error preparing commit PSBT via library';
      console.error('[Commit Step 1] Error:', errorMsg, err);
      setFlowError(`Prepare Commit Error: ${errorMsg}`);
      setFlowState('failed');
    }
  };

  // --- Step 1b: Sign and Broadcast Commit --- 
  const handleSignAndBroadcastCommit = async (unsignedCommitBase64: string) => {
       console.log("[Commit Step 1b] Signing and Broadcasting commit PSBT...");
       if (!walletAddress) {
         setFlowError("Wallet address is missing for signing.");
         setFlowState('failed');
         return;
       }
       if (!apiService) {
         setFlowError("API service is not available for broadcast.");
         setFlowState('failed');
         return;
       }
       if (!walletPublicKey) {
           setFlowError("Wallet public key missing, cannot find commit vout.");
           setFlowState('failed');
           return;
       }

       try {
           // Sign
           setFlowState('signingCommit'); 
           console.log("[Commit Step 1b] Requesting commit signature from wallet...");
           const signedBase64 = await signPsbt(unsignedCommitBase64);
           if (!signedBase64) {
               throw new Error('Wallet failed to sign the commit transaction.');
           }
           console.log("[Commit Step 1b] Commit PSBT signed by wallet.");
           const signedHex = Buffer.from(signedBase64, 'base64').toString('hex');
           setSignedCommitPsbtHex(signedHex);

           // Broadcast
           setFlowState('broadcastingCommit');
           console.log("[Commit Step 1b] Broadcasting signed commit transaction...");

           // Finalize the PSBT 
           const signedPsbt = bitcoin.Psbt.fromBase64(signedBase64, { network: networkConfig });
           // TODO: Validate finalization? Does the wallet return finalized?
           // Assuming wallet doesn't finalize, finalize all inputs here.
           signedPsbt.finalizeAllInputs(); 

           const commitTx = signedPsbt.extractTransaction();
           const commitTxHex = commitTx.toHex();
           const calculatedCommitTxid = commitTx.getId();
           console.log(`[Commit Step 1b] Final Commit TX Hex (length ${commitTxHex.length}): ${commitTxHex.substring(0,100)}...`);
           console.log(`[Commit Step 1b] Calculated Commit TXID: ${calculatedCommitTxid}`);

           // Use the API service's broadcast method
           const broadcastResponse = await apiService.broadcastTransaction(commitTxHex);
           const receivedTxid = (typeof broadcastResponse === 'string') ? broadcastResponse : broadcastResponse?.txid;

           if (!receivedTxid || typeof receivedTxid !== 'string' || receivedTxid.length < 64) {
               throw new Error(`Invalid transaction ID received from broadcast: ${JSON.stringify(broadcastResponse)}`);
           }
           console.log(`[Commit Step 1b] Broadcast successful. Commit TXID: ${receivedTxid}`);
           setCommitTxid(receivedTxid);

           // Find the commit Vout for the reveal input
           // Re-calculate script for lookup (assuming p2tr output from library matches)
           const internalPubKey = Buffer.from(walletPublicKey, 'hex').slice(1);
           const { output: commitOutputScript } = bitcoin.payments.p2tr({ internalPubkey: internalPubKey, network: networkConfig });
           if (!commitOutputScript) throw new Error("Failed to recalculate P2TR output script for vout lookup");
           const commitOutputScriptHex = commitOutputScript.toString('hex');

           const commitVoutIndex = commitTx.outs.findIndex(out => out.script.toString('hex') === commitOutputScriptHex);
           if (commitVoutIndex === -1) {
               console.error("[Commit Step 1b] Could not find commit output script in finalized transaction!", { txOutputs: commitTx.outs.map(o=>o.script.toString('hex')), searchScript: commitOutputScriptHex });
               throw new Error('Commit output script not found in finalized transaction. Cannot proceed with reveal.');
           }
           console.log(`[Commit Step 1b] Found commit output at vout: ${commitVoutIndex}`);
           setCommitVout(commitVoutIndex);

           // --- Proceed to reveal step (using OLD logic for now) --- 
           await handleConstructAndSignReveal(receivedTxid, commitVoutIndex);

       } catch (err) {
           const errorMsg = err instanceof Error ? err.message : 'Error signing or broadcasting commit transaction';
           console.error('[Commit Step 1b] Error:', errorMsg, err);
           setFlowError(`Sign/Broadcast Commit Error: ${errorMsg}`);
           setFlowState('failed');
       }
  };

  // --- STEP 2: Broadcast Commit Transaction ---
  const handleBroadcastCommit = async (signedCommitBase64: string) => {
    setFlowState('broadcastingCommit');
    console.log("[Commit Step 2] Broadcasting signed commit transaction...");

    try {
      // Finalize the PSBT (convert base64 to PSBT object)
      const signedPsbt = bitcoin.Psbt.fromBase64(signedCommitBase64, { network: networkConfig });
      // Finalize inputs (needed to extract final tx)
      signedPsbt.finalizeAllInputs(); // Finalize all inputs
      
      const commitTx = signedPsbt.extractTransaction();
      const commitTxHex = commitTx.toHex();
      const calculatedCommitTxid = commitTx.getId();
      console.log(`[Commit Step 2] Final Commit TX Hex (length ${commitTxHex.length}): ${commitTxHex.substring(0,100)}...`);
      console.log(`[Commit Step 2] Calculated Commit TXID: ${calculatedCommitTxid}`);

      if (!apiService) throw new Error("ApiService is not available");
      const broadcastResponse = await apiService.broadcastTransaction(commitTxHex);
      
      const receivedTxid = (typeof broadcastResponse === 'string') ? broadcastResponse : broadcastResponse?.txid;
      
      if (!receivedTxid || typeof receivedTxid !== 'string' || receivedTxid.length < 64) {
           throw new Error(`Invalid transaction ID received from broadcast: ${JSON.stringify(broadcastResponse)}`);
      }
      
      console.log(`[Commit Step 2] Broadcast successful. Commit TXID: ${receivedTxid}`);
      setCommitTxid(receivedTxid);

      // --- Find the commit Vout for the reveal input --- 
      // We need the output index (vout) of the P2TR script in the committed transaction
      if (typeof walletPublicKey !== 'string' || !walletPublicKey) {
          throw new Error("Wallet public key is missing, cannot find commit vout.");
      }
      const commitOutputScriptHex = getTaprootOutputScript(walletPublicKey).toString('hex');
      const commitVoutIndex = commitTx.outs.findIndex(out => out.script.toString('hex') === commitOutputScriptHex);
      
      if (commitVoutIndex === -1) {
          console.error("[Commit Step 2] Could not find commit output script in finalized transaction!", { txOutputs: commitTx.outs.map(o=>o.script.toString('hex')), searchScript: commitOutputScriptHex });
          throw new Error('Commit output script not found in finalized transaction. Cannot proceed with reveal.');
      }
      console.log(`[Commit Step 2] Found commit output at vout: ${commitVoutIndex}`);
      setCommitVout(commitVoutIndex);
      
      // Proceed to reveal step
      await handleConstructAndSignReveal(receivedTxid, commitVoutIndex);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error broadcasting commit transaction';
      console.error('[Commit Step 2] Error:', errorMsg, err);
      setFlowError(`Broadcast Commit Error: ${errorMsg}`);
      setFlowState('failed');
    }
  };

  // --- STEP 3: Construct and Sign Reveal PSBT (KEEPING OLD LOGIC FOR NOW) ---
  const handleConstructAndSignReveal = async (confirmedCommitTxid: string, confirmedCommitVout: number) => {
    setFlowState('constructingReveal');
    console.log(`[Reveal Step 3] Constructing Reveal PSBT using Commit TXID: ${confirmedCommitTxid}, Vout: ${confirmedCommitVout}`);

    // --- Validation --- 
    if (!revealPsbtBase64 || !revealSignerWif || !commitOutputValueFromApi) {
      setFlowError('Reveal PSBT data or signer key missing from state.');
      setFlowState('failed');
      return;
    }
    if (!walletAddress) {
      setFlowError('Recipient address (wallet address) missing.');
      setFlowState('failed');
      return;
    }

    try {
      const revealPsbt = bitcoin.Psbt.fromBase64(revealPsbtBase64, { network: networkConfig });
      console.log("[Reveal Step 3] Loaded reveal PSBT from backend response (using old flow).");
      
      if (typeof revealSignerWif !== 'string' || !revealSignerWif) {
          throw new Error("Reveal signer WIF is missing or invalid (using old flow).");
      }
      // @ts-ignore 
      const signerKeyPair = ECPair.fromWIF(revealSignerWif, networkConfig);
      // TEMP FIX: Convert public key to Buffer
      const signerPublicKeyBuffer = Buffer.from(signerKeyPair.publicKey);
      console.log(`[Reveal Step 3] Derived signer public key: ${signerPublicKeyBuffer.toString('hex')} (using old flow)`);

      const inputIndex = 0;
      
      if (typeof signerKeyPair.signSchnorr !== 'function') {
          throw new Error("signSchnorr method not found on signerKeyPair (using old flow).");
      }

      // Recreate schnorrSigner object with type conversions
      const schnorrSigner: bitcoin.Signer = {
          // TEMP FIX: Use Buffer public key
          publicKey: signerPublicKeyBuffer,
          // TEMP FIX: Wrap signSchnorr for Buffer/Uint8Array conversion
          signSchnorr: (hash: Buffer): Buffer => {
              const hashUint8Array = Uint8Array.from(hash);
              const signatureUint8Array = signerKeyPair.signSchnorr(hashUint8Array);
              return Buffer.from(signatureUint8Array);
          },
          // Add dummy sign method as before
          sign: (hash: Buffer): Buffer => {
                console.warn("[ResourceCreationForm] ECDSA sign method called unexpectedly on Schnorr signer!");
                throw new Error("ECDSA sign method called unexpectedly during Taproot script path signing (ResourceCreationForm).");
            },
      };

      revealPsbt.signInput(inputIndex, schnorrSigner, [bitcoin.Transaction.SIGHASH_DEFAULT]);
      console.log("[Reveal Step 3] Reveal PSBT input signed (using old flow).");

      // Finalize? Usually wallet handles this or it's done before extraction.
      // Let's assume signing is enough for now.
      
      const signedRevealHex = revealPsbt.toHex(); // Get hex of the signed PSBT
      console.log("[Reveal Step 3] Constructed signed reveal PSBT (hex):", signedRevealHex.substring(0, 100) + "...");
      setSignedRevealPsbtHex(signedRevealHex);
      setFlowState('signingReveal'); 

      await handleBroadcastReveal(revealPsbt.toBase64()); 

    } catch (err) { 
        // ... error handling ... 
    }
  };

  // --- STEP 4: Broadcast Reveal Transaction ---
  const handleBroadcastReveal = async (signedRevealBase64: string) => {
    setFlowState('broadcastingReveal');
    console.log("[Reveal Step 4] Broadcasting signed reveal transaction...");

    try {
      const revealPsbt = bitcoin.Psbt.fromBase64(signedRevealBase64, { network: networkConfig });
      // Finalize inputs (needed to extract final tx)
      revealPsbt.finalizeAllInputs(); // Finalize all inputs
      
      const revealTx = revealPsbt.extractTransaction();
      const revealTxHex = revealTx.toHex();
      const calculatedRevealTxid = revealTx.getId();
      console.log(`[Reveal Step 4] Final Reveal TX Hex (length ${revealTxHex.length}): ${revealTxHex.substring(0,100)}...`);
      console.log(`[Reveal Step 4] Calculated Reveal TXID: ${calculatedRevealTxid}`);

      if (!apiService) throw new Error("ApiService is not available");
      const broadcastResponse = await apiService.broadcastTransaction(revealTxHex);
      const receivedTxid = (typeof broadcastResponse === 'string') ? broadcastResponse : broadcastResponse?.txid;

      if (!receivedTxid || typeof receivedTxid !== 'string' || receivedTxid.length < 64) {
           throw new Error(`Invalid transaction ID received from broadcast: ${JSON.stringify(broadcastResponse)}`);
      }
      
      console.log(`[Reveal Step 4] Broadcast successful. Reveal TXID: ${receivedTxid}`);
      setRevealTxid(receivedTxid);

      // Start polling for confirmation
      pollTransactionStatus(receivedTxid);
      setFlowState('pollingStatus');

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error broadcasting reveal transaction';
      console.error('[Reveal Step 4] Error:', errorMsg, err);
      setFlowError(`Broadcast Reveal Error: ${errorMsg}`);
      setFlowState('failed');
    }
  };

  // --- STEP 5: Poll Transaction Status ---
  const pollTransactionStatus = (txid: string) => {
       console.log(`[Polling] Starting polling for reveal TXID: ${txid}`);
       console.time(`poll_${txid}`); // Start timer for poll duration
       setConfirmationStatus('Broadcasted. Waiting for confirmation...');

       if (pollingIntervalId) clearInterval(pollingIntervalId); // Clear previous interval if any

       const interval = setInterval(async () => {
           if (!apiService) {
               console.log("[Polling] API service not available, stopping poll.");
               setFlowError("API service unavailable, cannot check status.");
               setFlowState("failed");
               clearInterval(interval);
               setPollingIntervalId(null);
               return;
           }
           try {
               console.log(`[Polling] Checking status for ${txid}...`);
               const statusResponse = await apiService.getTransactionStatus(txid);
               console.log("[Polling] Status response:", statusResponse);

               if (statusResponse.status === 'confirmed') {
                   console.log(`[Polling] Transaction ${txid} confirmed!`);
                   setConfirmationStatus(`Confirmed in block ${statusResponse.blockHeight || 'N/A'}.`);
                   console.timeEnd(`poll_${txid}`); // End timer on confirmation
                   setFlowState('confirmed');
                   clearInterval(interval);
                   setPollingIntervalId(null);
                   // TODO: Maybe fetch final inscription details here?
               } else if (statusResponse.status === 'pending') {
                   setConfirmationStatus(`Pending... (Seen: ${statusResponse.seen ?? 'N/A'}, Confirmations: ${statusResponse.confirmations ?? 0})`);
                   // Continue polling
               } else { // Not found, error, etc.
                   console.warn(`[Polling] Non-pending/confirmed status for ${txid}:`, statusResponse.status);
                   console.timeEnd(`poll_${txid}`); // End timer on failure/stop
                   console.log(`[Polling] Transaction ${txid} not found or status unknown. Stopping poll.`);
                   setFlowError(`Transaction status check failed or TX not found for ${txid}.`);
                   setFlowState('failed'); // Consider if 'pending' is more appropriate if simply not found yet
                   clearInterval(interval);
                   setPollingIntervalId(null);
               }
           } catch (error) {
               console.error(`[Polling] Error checking transaction status for ${txid}:`, error);
               setFlowError(`Error checking transaction status: ${error instanceof Error ? error.message : 'Unknown error'}`);
               setFlowState('failed');
               console.timeEnd(`poll_${txid}`); // End timer on error
               clearInterval(interval);
               setPollingIntervalId(null);
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
