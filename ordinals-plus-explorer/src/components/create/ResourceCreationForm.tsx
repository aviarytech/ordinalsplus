import React, { useState, useEffect, useCallback, useRef } from 'react';
import { bytesToHex } from '@noble/hashes/utils';
import { Loader2, AlertCircle, CheckCircle, Copy, ExternalLink, Bitcoin, Upload, FileText, X, Check } from 'lucide-react';
import * as ordinalsplus from 'ordinalsplus';
import * as btc from '@scure/btc-signer';
import { useWallet, Utxo as WalletUtxo } from '../../context/WalletContext';
import { useApi } from '../../context/ApiContext';
import { useToast } from '../../contexts/ToastContext';
import ErrorDisplay from '../ui/ErrorDisplay';
import { StepIndicator, Tooltip, ConfirmationDialog } from '../ui';
import { InscriptionError, ErrorCategory, ErrorCode, ErrorSeverity } from '../../types/error';
import UtxoSelector from './UtxoSelector';
import FeeEstimator from '../fee/FeeEstimator';
import { utils as secpUtils } from '@noble/secp256k1';
import { schnorr } from '@noble/curves/secp256k1';
import { OrdinalInscription } from '../../../../ordinalsplus/src/inscription/scripts/ordinal-reveal';


const truncateMiddle = (str: string | null, length = 10): string => {
  if (!str) return '';
  if (str.length <= length * 2 + 3) return str;
  return `${str.substring(0, length)}...${str.substring(str.length - length)}`;
};

const supportedContentTypes = [
  { mime: 'text/plain', label: 'Text', isText: true },
  { mime: 'application/json', label: 'JSON', isText: true },
  { mime: 'image/png', label: 'PNG Image', isText: false },
  { mime: 'image/jpeg', label: 'JPEG Image', isText: false },
  { mime: 'image/svg+xml', label: 'SVG Image', isText: false },
];

// Define constants locally
const POSTAGE_VALUE = 1000n; // Use bigint

// Define more specific flow states
type FlowState =
  | 'idle'
  | 'awaitingContentType'
  | 'awaitingContent'
  | 'preparingInscription'
  | 'awaitingUtxoSelection'
  | 'preparingCommitTx'
  | 'awaitingCommitSignature'
  | 'broadcastingCommitTx'
  | 'awaitingCommitConfirmation'
  | 'commitConfirmedReadyForReveal'
  | 'constructingRevealTx'
  | 'broadcastingRevealTx'
  | 'awaitingRevealConfirmation'
  | 'inscriptionComplete'
  | 'failed';

// Update the interface to match our implementation
interface InscriptionPrepData {
  contentType: string;
  requiredCommitAmount: bigint;
  revealFee: bigint;
  commitAddress: string;
  commitScript: Uint8Array;  // Add this to store the script
  inscription: OrdinalInscription;
  inscriptionScript: {      // Add this to store the full inscription script structure
    script: Uint8Array;
    controlBlock: Uint8Array;
    leafVersion: number;
  };
  revealPublicKey: Uint8Array;  // Store the reveal public key
}

// Define the types locally if they're not properly exported
interface OrdinalsPlusUtxo {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey?: string;
}


/**
 * ResourceCreationForm orchestrates the resource creation flow using modular subcomponents.
 */
const ResourceCreationForm: React.FC = () => {
  const [contentType, setContentType] = useState<string>('text/plain;charset=utf-8');
  const [content, setContent] = useState<string>('');
  const [metadata, setMetadata] = useState<string>('');
  const [feeRateInput, setFeeRateInput] = useState<number>(10);
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [inscriptionPrepData, setInscriptionPrepData] = useState<InscriptionPrepData | null>(null);
  const [ephemeralRevealPrivateKeyWif, setEphemeralRevealPrivateKeyWif] = useState<string | null>(null);
  const [revealTxid, setRevealTxid] = useState<string | null>(null);
  const [commitTxidForDisplay, setCommitTxidForDisplay] = useState<string | null>(null);
  const [availableUtxos, setAvailableUtxos] = useState<WalletUtxo[]>([]);
  const [selectedUtxos, setSelectedUtxos] = useState<WalletUtxo[]>([]);
  const [isFetchingUtxos, setIsFetchingUtxos] = useState<boolean>(false);
  const [utxoError, setUtxoError] = useState<string | null>(null);
  const [calculatedCommitFee, setCalculatedCommitFee] = useState<bigint | null>(null);
  const [unsignedCommitPsbt, setUnsignedCommitPsbt] = useState<string | null>(null);
  const [signedCommitPsbt, setSignedCommitPsbt] = useState<string | null>(null);
  const [finalCommitTxid, setFinalCommitTxid] = useState<string | null>(null);
  const [finalCommitVout, setFinalCommitVout] = useState<number | null>(null);
  const [finalCommitAmount, setFinalCommitAmount] = useState<bigint | null>(null);
  const [showCommitConfirmation, setShowCommitConfirmation] = useState<boolean>(false);
  const [showRevealConfirmation, setShowRevealConfirmation] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<string>('idle');
  const [ephemeralKeyData, setEphemeralKeyData] = useState<{ revealPrivateKeyWif: string; revealPublicKeyBytes: Uint8Array } | null>(null);
  const [finalRevealTxid, setFinalRevealTxid] = useState<string | null>(null);
  const [finalRevealTxHex, setFinalRevealTxHex] = useState<string | null>(null);
  const [revealComplete, setRevealComplete] = useState<boolean>(false);
  const [inscriptionPrepComplete, setInscriptionPrepComplete] = useState<boolean>(false);
  const [extractedCommitTx, setExtractedCommitTx] = useState<string | null>(null);
  const [showDirectTextEditor, setShowDirectTextEditor] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    connected: walletConnected,
    address: walletAddress,
    signPsbt,
    getUtxos,
    network: walletNetwork,
  } = useWallet();
  const { apiService } = useApi();
  const { addToast, addErrorToast } = useToast();
  
  // Convert walletNetwork to the expected BitcoinNetwork type for ordinalsplus
  const getOrdinalsPlusNetwork = (network: string | null | undefined): 'mainnet' | 'testnet' | 'signet' => {
    if (!network) return 'mainnet';
    if (network === 'testnet') return 'testnet';
    if (network === 'signet') return 'signet';
    return 'mainnet';
  };
  
  // Add the BTC_NETWORK constant here where walletNetwork is available
  const BTC_NETWORK = walletNetwork ? getOrdinalsPlusNetwork(walletNetwork) : 'mainnet';
  
  const blockExplorerUrl = walletNetwork === 'testnet'
    ? 'https://mempool.space/testnet'
    : 'https://mempool.space';
  const currentFeeRate = feeRateInput;

  // Define steps for the inscription process
  const inscriptionSteps = [
    { id: 'content', label: 'Content', description: 'Configure inscription content' },
    { id: 'utxo', label: 'UTXO', description: 'Select funding source' },
    { id: 'commit', label: 'Commit', description: 'Sign & broadcast commit' },
    { id: 'reveal', label: 'Reveal', description: 'Create inscription' },
    { id: 'complete', label: 'Complete', description: 'View inscription' },
  ];

  // Determine current step based on flow state
  const getCurrentStepIndex = (): number => {
    // Map flow states to steps
    if (flowState === 'idle' || 
        flowState === 'awaitingContentType' || 
        flowState === 'awaitingContent' || 
        flowState === 'preparingInscription') {
      return 0; // Content step
    } else if (flowState === 'awaitingUtxoSelection' || 
               flowState === 'preparingCommitTx') {
      return 1; // UTXO step
    } else if (flowState === 'awaitingCommitSignature' || 
               flowState === 'broadcastingCommitTx' || 
               flowState === 'awaitingCommitConfirmation') {
      return 2; // Commit step
    } else if (flowState === 'commitConfirmedReadyForReveal' || 
               flowState === 'constructingRevealTx' || 
               flowState === 'broadcastingRevealTx' || 
               flowState === 'awaitingRevealConfirmation') {
      return 3; // Reveal step
    } else if (flowState === 'inscriptionComplete') {
      return 4; // Complete step
    } else if (flowState === 'failed') {
      // For failed state, return the last active step
      return Math.max(0, inscriptionSteps.findIndex(step => {
        if (step.id === 'content' && content) return true;
        if (step.id === 'utxo' && selectedUtxos.length > 0) return true;
        if (step.id === 'commit' && finalCommitTxid) return true;
        if (step.id === 'reveal' && revealTxid) return true;
        return false;
      }));
    }
    return 0; // Default to first step
  };

  useEffect(() => {
    if (!walletConnected) {
      resetFlow();
    }
  }, [walletConnected]);

  const resetFlow = () => {
    console.log("[ResetFlow] Resetting state...");
    setFlowState('idle');
    setErrorMessage(null);
    setStatusMessage(null);
    setInscriptionPrepData(null);
    setEphemeralRevealPrivateKeyWif(null);
    setRevealTxid(null);
    setCommitTxidForDisplay(null);
    setAvailableUtxos([]);
    setSelectedUtxos([]);
    setIsFetchingUtxos(false);
    setUtxoError(null);
    setCalculatedCommitFee(null);
    setUnsignedCommitPsbt(null);
    setSignedCommitPsbt(null);
    setFinalCommitTxid(null);
    setFinalCommitVout(null);
    setFinalCommitAmount(null);
    setIsLoading(false);
    setCurrentStep('idle');
    setEphemeralKeyData(null);
    setFinalRevealTxid(null);
    setFinalRevealTxHex(null);
    setRevealComplete(false);
    setInscriptionPrepComplete(false);
    setExtractedCommitTx(null);
    setShowDirectTextEditor(false);
    setUploadedFileName(null);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      console.log("Copied to clipboard:", text);
    }).catch(err => {
      console.error("Failed to copy:", err);
    });
  };

  const parseMetadata = (jsonString: string): Record<string, string> | undefined => {
    if (!jsonString.trim()) return undefined;
    try {
      const parsed = JSON.parse(jsonString);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error("Metadata must be a JSON object.");
      }
      const stringified: Record<string, string> = {};
      for (const key in parsed) {
        if (Object.prototype.hasOwnProperty.call(parsed, key)) {
          if (typeof parsed[key] !== 'string') {
             throw new Error(`Metadata value for key "${key}" must be a string.`);
          }
          stringified[key] = parsed[key];
        }
      }
      return stringified;
    } catch (e) {
      throw new Error(`Invalid JSON metadata: ${(e as Error).message}`);
    }
  };

  // Helper function to create structured errors
  const createError = (
    code: ErrorCode | string,
    message: string,
    details?: string,
    category: ErrorCategory = ErrorCategory.INSCRIPTION
  ): InscriptionError => {
    return {
      code: code as ErrorCode, // Cast string to ErrorCode
      message,
      details,
      category,
      severity: 
        category === ErrorCategory.VALIDATION ? ErrorSeverity.WARNING :
        category === ErrorCategory.NETWORK ? ErrorSeverity.ERROR :
        ErrorSeverity.ERROR,
      timestamp: new Date(),
      recoverable: category === ErrorCategory.NETWORK || category === ErrorCategory.VALIDATION,
      suggestion: 
        category === ErrorCategory.NETWORK 
          ? 'Check your internet connection and try again.' 
          : category === ErrorCategory.VALIDATION 
          ? 'Please review your inputs and try again.'
          : 'You may need to restart the process.',
    };
  };

  const handlePrepareInscription = async () => {
    console.log("[PrepareInscription] Starting preparation...");
    setFlowState('preparingInscription');
    setErrorMessage(null);
    setStatusMessage('Generating ephemeral key and preparing inscription data...');
    setInscriptionPrepData(null);
    setEphemeralRevealPrivateKeyWif(null);

    if (!walletAddress) {
      const error = createError(
        'WALLET_NOT_CONNECTED',
        'Wallet address is missing. Please reconnect.',
        'Unable to get wallet address for inscription.',
        ErrorCategory.WALLET
      );
      setErrorMessage(error.message);
      addErrorToast(error);
      setFlowState('failed');
      return;
    }

    try {
      console.log("[PrepareInscription] Generating ephemeral keypair...");
      const revealPrivateKeyBytes = secpUtils.randomPrivateKey();
      const revealPublicKeyBytes = btc.utils.pubSchnorr(revealPrivateKeyBytes);
      console.log('revealPublicKeyBytes', Buffer.from(revealPublicKeyBytes).toString('hex'));
      setEphemeralRevealPrivateKeyWif(Buffer.from(revealPrivateKeyBytes).toString('hex'));
      console.log(`[PrepareInscription] Ephemeral Public Key generated: ${bytesToHex(revealPublicKeyBytes)}`);
      console.log(`[PrepareInscription] Stored Ephemeral Private Key WIF.`);
      
      const parsedMeta = parseMetadata(metadata);
      
      console.log("[PrepareInscription] Preparing inscription data using createInscription...");
      
      // Use the properly exported createInscription function
      const preparedInscription = ordinalsplus.createInscription({
        content: content,
        contentType: contentType,
        metadata: parsedMeta,
        revealPublicKey: revealPublicKeyBytes,
        network: BTC_NETWORK
      });
      
      // Store the prepared inscription data more completely
      console.log("[PrepareInscription] Storing complete inscription data for later reveal use");
      console.log(`[PrepareInscription] Commit script hex: ${
        preparedInscription.commitAddress.script ? 
        Buffer.from(preparedInscription.commitAddress.script).toString('hex') : 
        'undefined'}`);
      console.log(`[PrepareInscription] Inscription script hex: ${
        preparedInscription.inscriptionScript ? 
        Buffer.from(preparedInscription.inscriptionScript.script).toString('hex') : 
        'undefined'}`);
      
      // Calculate fees using exported calculateFee function
      const safetyBufferFeeRate = currentFeeRate + 0.1;
      console.log(`[PrepareInscription] Using fee rate with safety buffer: ${safetyBufferFeeRate} sats/vB (original: ${currentFeeRate} sats/vB)`);

      // Using the exported calculateFee function - FIX THE FEE CALCULATION
      // Calculate proper vbytes for the transaction instead of just using content length
      const contentSizeBytes = Buffer.from(content).length;
      const baseRevealTxSize = 200; // Base size of the reveal transaction
      // For large inscriptions, we need to account for extra witnesses and script overhead
      const estimatedTotalVBytes = baseRevealTxSize + (contentSizeBytes * 1.02);
      console.log(`[PrepareInscription] Content size: ${contentSizeBytes} bytes, estimated transaction vbytes: ${estimatedTotalVBytes}`);
      
      const revealFee = ordinalsplus.calculateFee(Math.ceil(estimatedTotalVBytes), safetyBufferFeeRate);
      
      console.log(`[PrepareInscription] Estimated reveal fee: ${revealFee} sats`);
      
      const requiredCommitAmount = BigInt(revealFee) + POSTAGE_VALUE;
      console.log(`[PrepareInscription] Required commit amount (Reveal Fee + Postage): ${requiredCommitAmount} sats`);

      // Store all the important data including scripts and keys
      setInscriptionPrepData({
        contentType,
        requiredCommitAmount,
        revealFee: BigInt(revealFee),
        commitAddress: preparedInscription.commitAddress.address,
        commitScript: preparedInscription.commitAddress.script,
        inscription: preparedInscription.inscription,
        inscriptionScript: preparedInscription.inscriptionScript,
        revealPublicKey: revealPublicKeyBytes
      });

      // Store the ephemeral key data for reveal
      setEphemeralKeyData({
        revealPrivateKeyWif: Buffer.from(revealPrivateKeyBytes).toString('hex'),
        revealPublicKeyBytes: revealPublicKeyBytes
      });

      setStatusMessage('Inscription data prepared. Please select UTXOs to fund the commit transaction.');
      setFlowState('awaitingUtxoSelection');
      setInscriptionPrepComplete(true);

    } catch (error) {
      console.error("[PrepareInscription] Error:", error);
      
      let structuredError: InscriptionError;
      if (error instanceof Error) {
        structuredError = createError(
          'INSCRIPTION_PREPARATION_FAILED',
          error.message,
          'Error occurred while preparing inscription data.',
          ErrorCategory.INSCRIPTION
        );
      } else {
        structuredError = createError(
          'UNKNOWN_ERROR',
          'An unknown error occurred during inscription preparation.',
          String(error),
          ErrorCategory.UNKNOWN
        );
      }
      
      setErrorMessage(structuredError.message);
      addErrorToast(structuredError);
      setFlowState('failed');
    }
  };

  const handleFetchUtxos = useCallback(async () => {
      console.log("[FetchUtxos] Fetching UTXOs...");
      setIsFetchingUtxos(true);
      setUtxoError(null);
      setAvailableUtxos([]);
      setSelectedUtxos([]);

      try {
          const utxosFromWallet = await getUtxos();
          console.log(`[FetchUtxos] Received ${utxosFromWallet.length} UTXOs`);
          if (utxosFromWallet.length === 0) {
              setUtxoError("No UTXOs found for your address.");
          }
          setAvailableUtxos(utxosFromWallet);
      } catch (error) {
          console.error("[FetchUtxos] Error:", error);
          const msg = `Failed to fetch UTXOs: ${(error as Error).message}`;
          setUtxoError(msg);
          setErrorMessage(msg);
          setFlowState('failed');
      } finally {
          setIsFetchingUtxos(false);
      }
  }, [getUtxos]);

  const handleUtxoSelectionChange = (utxo: WalletUtxo, isSelected: boolean) => {
    setSelectedUtxos(prevSelected => {
      if (isSelected) {
        return prevSelected.some(u => u.txid === utxo.txid && u.vout === utxo.vout)
          ? prevSelected
          : [...prevSelected, utxo];
      } else {
        return prevSelected.filter(u => !(u.txid === utxo.txid && u.vout === utxo.vout));
      }
    });
    setErrorMessage(null);
    setUtxoError(null);
  };

  const totalSelectedValue = selectedUtxos.reduce((sum, utxo) => sum + BigInt(utxo.value), 0n);

  const handlePrepareAndSignCommit = async () => {
    console.log("[PrepareAndSignCommit] Starting...");
    if (!inscriptionPrepData || !walletAddress || !apiService || !walletNetwork) {
        setErrorMessage("Missing prep data, address, API service, or network.");
        setFlowState('failed');
        return;
    }
    if (selectedUtxos.length === 0) {
        setErrorMessage("Please select UTXO(s) to fund the transaction.");
        return;
    }

    // Filter and map selected WalletUtxos to OrdinalsPlusUtxo for the library call
    const utxosForApi: OrdinalsPlusUtxo[] = selectedUtxos
        .filter(utxo => utxo.scriptPubKey !== undefined)
        .map(utxo => {
            if (utxo.scriptPubKey === undefined) {
                throw new Error(`UTXO ${utxo.txid}:${utxo.vout} is missing scriptPubKey.`);
            }
            return {
                txid: utxo.txid,
                vout: utxo.vout,
                value: utxo.value,
                scriptPubKey: utxo.scriptPubKey,
            };
        });

    if (utxosForApi.length !== selectedUtxos.length) {
         console.warn("Some selected UTXOs were filtered out due to missing scriptPubKey.");
         if (utxosForApi.length === 0) {
             setErrorMessage("All selected UTXOs are invalid (missing scriptPubKey).");
             setFlowState('failed');
             return;
         }
    }

    setFlowState('preparingCommitTx');
    setStatusMessage("Preparing commit transaction...");
    setErrorMessage(null);
    setUnsignedCommitPsbt(null);
    setSignedCommitPsbt(null);
    setCalculatedCommitFee(null); // Clear previous fee

    try {
        const requiredCommitAmount = inscriptionPrepData.requiredCommitAmount;
        console.log(`[PrepareAndSignCommit] Creating commit transaction...`);
        
        // Ensure fee rate is slightly higher than minimum to avoid relay issues
        const safetyBufferFeeRate = currentFeeRate + 0.1;
        console.log(`[PrepareAndSignCommit] Using fee rate with safety buffer: ${safetyBufferFeeRate} sats/vB (original: ${currentFeeRate} sats/vB)`);
        
        const ephemeralRevealPrivateKeyBytes = Uint8Array.from(
          Buffer.from(ephemeralRevealPrivateKeyWif || '', 'hex')
        );
        // Create minimal inscription with just the address - our modified library will handle deriving the script
        const minimalInscription = {
            commitAddress: {
                address: inscriptionPrepData.commitAddress,
                script: new Uint8Array(0) // Empty script will now be derived from address by our modified library
            },
            inscription: inscriptionPrepData.inscription,
            revealPublicKey: schnorr.getPublicKey(ephemeralRevealPrivateKeyBytes)
        };
        
        console.log(`[PrepareAndSignCommit] Using commit address: ${inscriptionPrepData.commitAddress}`);
        
        // Use the standard prepareCommitTransaction function with our minimal inscription
        const result = await ordinalsplus.prepareCommitTransaction({
            inscription: minimalInscription as any,
            utxos: utxosForApi,
            changeAddress: walletAddress,
            feeRate: safetyBufferFeeRate,
            network: BTC_NETWORK,
            minimumCommitAmount: Number(requiredCommitAmount)
        });
        
        console.log(`[PrepareAndSignCommit] Commit transaction prepared, fee: ${result.fees.commit} sats`);
        setCalculatedCommitFee(BigInt(result.fees.commit));
        
        // Validate sufficiency of inputs
        if (totalSelectedValue < requiredCommitAmount + BigInt(result.fees.commit)) {
            throw new Error(`Selected valid UTXOs value (${totalSelectedValue} sats) is insufficient for required amount (${requiredCommitAmount} sats) + calculated commit fee (${result.fees.commit} sats).`);
        }
        
        setUnsignedCommitPsbt(result.commitPsbtBase64);
        
        // Proceed with signing and broadcasting
        setFlowState('awaitingCommitSignature');
        setStatusMessage("Please sign the commit transaction in your wallet.");
        console.log("[PrepareAndSignCommit] Requesting signature for commit PSBT...");
        const signedPsbtHex = await signPsbt(result.commitPsbtBase64);
        console.log("[PrepareAndSignCommit] Commit PSBT signed by wallet.");
        await handleBroadcastCommit(walletNetwork || 'bitcoin', signedPsbtHex);

    } catch (error) {
        console.error("[PrepareAndSignCommit] Error:", error);
        setErrorMessage(`Commit preparation/signing failed: ${(error as Error).message}`);
        setFlowState('failed');
    }
};

  const handleBroadcastCommit = async (network: string, signedPsbtHex: string) => {
    try {
      console.log("[BroadcastCommit] Starting broadcast...");
      console.log("[BroadcastCommit] PSBT begins with:", signedPsbtHex.substring(0, 30) + "...");
      console.log("[BroadcastCommit] PSBT length:", signedPsbtHex.length);
      setErrorMessage(null);
      setStatusMessage('Finalizing and broadcasting commit transaction...');
      setFlowState('broadcastingCommitTx');
      
      if (!apiService) {
        throw new Error('API service not available');
      }
      
      // Finalize the PSBT and extract the raw transaction
      try {
        console.log("[BroadcastCommit] Finalizing PSBT...");
        const finalizedTx = ordinalsplus.finalizePsbt(signedPsbtHex);
        console.log("[BroadcastCommit] PSBT finalized successfully");
        
        console.log("[BroadcastCommit] Extracting transaction...");
        const extractedTxHex = ordinalsplus.extractTransaction(finalizedTx);
        console.log("[BroadcastCommit] Transaction extracted successfully, hex begins with:", extractedTxHex.substring(0, 30) + "...");
        console.log("[BroadcastCommit] Transaction hex length:", extractedTxHex.length);
        setExtractedCommitTx(extractedTxHex);
        
        // Broadcast the extracted transaction
        console.log("[BroadcastCommit] Broadcasting transaction...");
        const response = await apiService.broadcastTransaction(network, extractedTxHex);
        // Fix: Extract txid from response
        const txid = typeof response === 'object' && response !== null ? response.txid : response;
        console.log(`[BroadcastCommit] Commit transaction broadcast with txid: ${txid}`);
        setFinalCommitTxid(txid);
        setCommitTxidForDisplay(txid);
        
        // Create a copy of the final values needed for reveal - vout will be 0 for P2TR typically
        // Use these values to set up the reveal transaction
        setFinalCommitVout(0); // Assuming the output is always the first one (index 0)
        
        // Extract the amount from the unsignedCommitPsbt if available or use the required amount
        // This should be the exact amount sent to the commit address
        if (inscriptionPrepData) {
          setFinalCommitAmount(inscriptionPrepData.requiredCommitAmount);
        }
        
        addToast(
          `Your commit transaction has been broadcast with TXID: ${truncateMiddle(txid, 8)}`,
          'success',
          5000
        );
        
        // Change flow state to be ready for reveal immediately
        setStatusMessage('Commit transaction broadcast. Ready for reveal transaction.');
        setFlowState('commitConfirmedReadyForReveal');
        
        // Start background polling for confirmation, but don't block reveal transaction
        const checkConfirmationInterval = setInterval(async () => {
          try {
            if (!apiService || !txid) {
              clearInterval(checkConfirmationInterval);
              return;
            }
            
            // Use the correct API method - getTransactionStatus instead of getTransactionInfo
            console.log(`[CheckConfirmation] Checking status for txid: ${txid}`);
            const txStatus = await apiService.getTransactionStatus(network, txid);
            console.log(`[CheckConfirmation] Commit tx status:`, txStatus);
            
            if (txStatus && txStatus.status === 'confirmed' && txStatus.confirmations && txStatus.confirmations > 0) {
              clearInterval(checkConfirmationInterval);
              console.log(`[CheckConfirmation] Commit transaction confirmed with ${txStatus.confirmations} confirmations`);
              
              // The transaction is confirmed in the background
              addToast(
                'Your commit transaction has been confirmed by the network.',
                'success',
                5000
              );
            }
          } catch (error) {
            console.error("[CheckConfirmation] Error checking confirmation:", error);
            // Don't stop checking on error, just log it
          }
        }, 30000); // Check every 30 seconds
        
        // Return the txid for potential future use
        return txid;
      } catch (finalizationError) {
        console.error("[BroadcastCommit] Error in PSBT finalization or extraction:", finalizationError);
        
        // Try to use a fallback method: directly broadcast the signed PSBT
        if (signedPsbtHex) {
          console.log("[BroadcastCommit] Attempting fallback: Broadcasting signed PSBT directly...");
          try {
            const response = await apiService.broadcastTransaction(network, signedPsbtHex);
            const txid = typeof response === 'object' && response !== null ? response.txid : response;
            console.log(`[BroadcastCommit] Fallback successful! Transaction broadcast with txid: ${txid}`);
            
            setFinalCommitTxid(txid);
            setCommitTxidForDisplay(txid);
            
            // Same as above, set up for reveal immediately
            setFinalCommitVout(0);
            if (inscriptionPrepData) {
              setFinalCommitAmount(inscriptionPrepData.requiredCommitAmount);
            }
            
            setStatusMessage('Commit transaction broadcast using fallback method. Ready for reveal transaction.');
            setFlowState('commitConfirmedReadyForReveal');
            
            addToast(
              `Your commit transaction has been broadcast with TXID: ${truncateMiddle(txid, 8)}`,
              'success',
              5000
            );
            
            return txid;
          } catch (fallbackError) {
            console.error("[BroadcastCommit] Fallback broadcast failed:", fallbackError);
            throw new Error(`PSBT finalization failed and fallback broadcast failed: ${finalizationError instanceof Error ? finalizationError.message : String(finalizationError)}; Fallback error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
          }
        } else {
          throw finalizationError;
        }
      }
    } catch (error) {
      console.error("[BroadcastCommit] Error broadcasting commit transaction:", error);
      const errorObj = createError(
        'BROADCAST_FAILURE',
        'Failed to broadcast commit transaction',
        (error as Error).message,
        ErrorCategory.NETWORK
      );
      setErrorMessage(errorObj.message);
      addErrorToast(errorObj);
      setFlowState('failed');
      throw error;
    }
  };

  const handleBroadcastReveal = async (revealTxHex: string) => {
    try {
      console.log("[BroadcastReveal] Starting broadcast...");
      setErrorMessage(null);
      setStatusMessage('Broadcasting reveal transaction...');
      setFlowState('broadcastingRevealTx');
      
      if (!apiService || !walletNetwork) {
        throw new Error('API service or network not available');
      }
      
      const response = await apiService.broadcastTransaction(walletNetwork, revealTxHex);
      const txid = typeof response === 'object' && response !== null ? response.txid : response;
      console.log(`[BroadcastReveal] Reveal transaction broadcast with txid: ${txid}`);
      setFinalRevealTxid(txid);
      setRevealTxid(txid);
      setFinalRevealTxHex(revealTxHex);
      setStatusMessage('Reveal transaction broadcast. Waiting for confirmation...');
      setFlowState('awaitingRevealConfirmation');
      
      addToast(
        `Your inscription creation transaction has been broadcast with TXID: ${truncateMiddle(txid, 8)}`,
        'success',
        5000
      );
      
      // After a brief delay, mark as complete for better UX
      setTimeout(() => {
        setStatusMessage('Inscription completed successfully!');
        setFlowState('inscriptionComplete');
        setRevealComplete(true);
        
        addToast(
          'Your inscription has been successfully created and broadcast to the network.',
          'success',
          5000
        );
      }, 3000);
      
      return txid;
    } catch (error) {
      console.error("[BroadcastReveal] Error broadcasting reveal transaction:", error);
      const errorObj = createError(
        'BROADCAST_FAILURE',
        'Failed to broadcast reveal transaction',
        (error as Error).message,
        ErrorCategory.NETWORK
      );
      setErrorMessage(errorObj.message);
      addErrorToast(errorObj);
      setFlowState('failed');
      throw error;
    }
  };

  const handleCommitFunded = async () => {
    console.log("[ConstructAndBroadcastReveal] Starting reveal step...");
    setErrorMessage(null);

    if (!finalCommitTxid || finalCommitVout === null || finalCommitAmount === null || 
        !inscriptionPrepData || !walletAddress || !ephemeralRevealPrivateKeyWif) {
      setErrorMessage("Commit details, prep data, wallet address, or ephemeral reveal key missing.");
      setFlowState('failed');
      return;
    }

    console.log(`[ConstructAndBroadcastReveal] Using confirmed commit TXID: ${finalCommitTxid}, VOUT: ${finalCommitVout}, Amount: ${finalCommitAmount}`);

    try {
      setFlowState('constructingRevealTx');
      setStatusMessage('Constructing final reveal transaction using generated key...');

      // Make sure we use a reveal fee that will be accepted by the network
      // Add a small buffer to the fee to avoid minimum relay fee issues
      const revealFeeRate = currentFeeRate + 0.1;
      console.log(`[ConstructAndBroadcastReveal] Using reveal fee rate with safety buffer: ${revealFeeRate} sats/vB (original: ${currentFeeRate} sats/vB)`);
      
      // Reconstruct the ephemeral private key from hex
      const ephemeralPrivateKeyBytes = Uint8Array.from(
        Buffer.from(ephemeralRevealPrivateKeyWif, 'hex')
      );

      // Get the scure network value
      const scureNetwork = ordinalsplus.getScureNetwork(BTC_NETWORK);
      
      // Debug log all stored inscription data to help diagnose the issue
      console.log(`[DEBUG-REVEAL-STORED-DATA] Full inscriptionPrepData:`, {
        contentType: inscriptionPrepData.contentType,
        requiredCommitAmount: inscriptionPrepData.requiredCommitAmount.toString(),
        revealFee: inscriptionPrepData.revealFee.toString(),
        commitAddress: inscriptionPrepData.commitAddress,
        hasCommitScript: !!inscriptionPrepData.commitScript,
        commitScriptLength: inscriptionPrepData.commitScript ? inscriptionPrepData.commitScript.length : 0,
        commitScriptHex: inscriptionPrepData.commitScript ? Buffer.from(inscriptionPrepData.commitScript).toString('hex') : 'empty',
        hasRevealPublicKey: !!inscriptionPrepData.revealPublicKey,
        revealPublicKeyHex: inscriptionPrepData.revealPublicKey ? Buffer.from(inscriptionPrepData.revealPublicKey).toString('hex') : 'empty',
        hasInscriptionScript: !!inscriptionPrepData.inscriptionScript,
        inscriptionScriptDetails: inscriptionPrepData.inscriptionScript ? {
          scriptLength: inscriptionPrepData.inscriptionScript.script.length,
          scriptHex: Buffer.from(inscriptionPrepData.inscriptionScript.script).toString('hex').substring(0, 50) + '...',
          controlBlockLength: inscriptionPrepData.inscriptionScript.controlBlock.length,
          controlBlockHex: Buffer.from(inscriptionPrepData.inscriptionScript.controlBlock).toString('hex').substring(0, 50) + '...',
          leafVersion: inscriptionPrepData.inscriptionScript.leafVersion
        } : 'missing'
      });
      
      console.log(`[ConstructAndBroadcastReveal] Creating reveal transaction with ephemeral key`);
      
      // Log the important script data for debugging
      console.log(`[DEBUG-REVEAL-PRE] Using commit script: ${
        inscriptionPrepData.commitScript ? 
        Buffer.from(inscriptionPrepData.commitScript).toString('hex') : 
        'undefined or empty'
      }`);
      console.log(`[DEBUG-REVEAL-PRE] Using inscription script: ${
        inscriptionPrepData.inscriptionScript ? 
        Buffer.from(inscriptionPrepData.inscriptionScript.script).toString('hex') : 
        'undefined or empty'
      }`);
      
      // Use the complete stored inscription data for reveal
      const revealTx = await ordinalsplus.createRevealTransaction({
        selectedUTXO: {
          txid: finalCommitTxid,
          vout: finalCommitVout,
          value: Number(finalCommitAmount),
          script: { 
            type: 'p2tr',
            address: inscriptionPrepData.commitAddress 
          }
        },
        preparedInscription: {
          // Use the original inscription object from stored state
          inscription: inscriptionPrepData.inscription,
          // Use the original commitAddress with script
          commitAddress: {
            address: inscriptionPrepData.commitAddress,
            script: inscriptionPrepData.commitScript,
            internalKey: new Uint8Array() // Required field but not actually used
          },
          // Use the original reveal public key
          revealPublicKey: inscriptionPrepData.revealPublicKey,
          // Include the original inscription script
          inscriptionScript: inscriptionPrepData.inscriptionScript,
          // Add revealPrivateKey (needed for signing)
          revealPrivateKey: ephemeralPrivateKeyBytes
        },
        privateKey: ephemeralPrivateKeyBytes,
        feeRate: currentFeeRate,
        network: scureNetwork,
        commitTransactionId: finalCommitTxid,
        // Add destination address parameter to send the inscription to user's wallet
        destinationAddress: walletAddress
      });
      
      // Extract transaction ID using the correct property names
      const txid = revealTx.tx.id;
      console.log(`[ConstructAndBroadcastReveal] Reveal TX constructed. Txid: ${txid}`);
      setRevealTxid(txid);

      await handleBroadcastReveal(revealTx.hex);

    } catch (error) {
      console.error("[ConstructAndBroadcastReveal] Error:", error);
      setErrorMessage(`Reveal process failed: ${(error as Error).message}`);
      setFlowState('failed');
    }
  };

  // Handle fee calculation from FeeEstimator
  const handleFeeCalculated = (fees: {
    commitFee: number;
    revealFee: number;
    totalFee: number;
    minimumRequiredAmount: number;
    commitTxSize?: number;
    revealTxSize?: number;
  } | null) => {
    if (fees) {
      // Update the fee rate - use actual fee rate or calculate effective rate
      if (fees.commitTxSize && fees.revealTxSize) {
        // Get the effective fee rate from the total fees and sizes
        const calculatedFeeRate = Math.max(1, Math.round(fees.totalFee / (fees.commitTxSize + fees.revealTxSize)));
        // Update the fee rate input
        setFeeRateInput(calculatedFeeRate);
        
        console.log(`[FeeEstimator] Fee breakdown - Total: ${fees.totalFee} sats, Rate: ${calculatedFeeRate} sats/vB`);
      } else {
        // Fallback if we don't have size info - just use a reasonable fee rate
        const fallbackRate = Math.max(1, Math.round(fees.totalFee / 250)); // Assuming ~250vB transaction
        setFeeRateInput(fallbackRate);
        
        console.log(`[FeeEstimator] Using fallback fee rate: ${fallbackRate} sats/vB based on total fee: ${fees.totalFee} sats`);
      }
      
      console.log(`[FeeEstimator] Details - Commit: ${fees.commitFee} sats, Reveal: ${fees.revealFee} sats, Min Required: ${fees.minimumRequiredAmount} sats`);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploadedFileName(file.name);
    setErrorMessage(null);
    
    // Update content type based on the file MIME type
    const fileType = file.type;
    if (fileType) {
      // For text files, add charset
      if (fileType.startsWith('text/')) {
        setContentType(`${fileType};charset=utf-8`);
      } else {
        setContentType(fileType);
      }
    } else {
      // Fallback to guessing by extension
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'json') {
        setContentType('application/json;charset=utf-8');
      } else if (extension === 'txt') {
        setContentType('text/plain;charset=utf-8');
      } else if (extension === 'png') {
        setContentType('image/png');
      } else if (extension === 'jpg' || extension === 'jpeg') {
        setContentType('image/jpeg');
      } else if (extension === 'svg') {
        setContentType('image/svg+xml');
      }
    }
    
    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        // For text files, use the content directly
        if (fileType.startsWith('text/') || fileType === 'application/json') {
          setContent(result);
        } else {
          // For binary files, convert to base64 data URL
          setContent(result);
        }
      } else if (result instanceof ArrayBuffer) {
        // Handle binary data
        const base64 = btoa(
          new Uint8Array(result)
            .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        setContent(`data:${fileType};base64,${base64}`);
      }
    };
    
    // Read as text or data URL based on file type
    if (fileType.startsWith('text/') || fileType === 'application/json') {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  };

  const clearUploadedFile = () => {
    setUploadedFileName(null);
    setContent('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderCurrentStep = () => {
    // Get existing content (same as before)
    let stepContent;
    
    if (!walletConnected) {
      stepContent = (
        <div className="text-center p-6">
          <Bitcoin className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Please connect your wallet to create an inscription
          </p>
        </div>
      );
    } else if (flowState === 'idle' || flowState === 'awaitingContentType' || flowState === 'awaitingContent') {
      stepContent = (
        <div className="space-y-4">
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Tooltip
                  content={
                    <div>
                      <p>Content type defines how your inscription will be interpreted.</p>
                      <ul className="list-disc list-inside mt-1">
                        <li>Text: Plain UTF-8 encoded text</li>
                        <li>JSON: Structured data in JSON format</li>
                        <li>Images: Supported formats include PNG, JPEG, and SVG</li>
                      </ul>
                    </div>
                  }
                  position="top"
                  showIcon={true}
                >
                  Content Type
                </Tooltip>
              </label>
              <div className="flex flex-wrap gap-2">
                {supportedContentTypes.map((type) => (
                  <button
                    key={type.mime}
                    type="button"
                    onClick={() => {
                      setContentType(type.isText ? `${type.mime};charset=utf-8` : type.mime);
                      setUploadedFileName(null);
                    }}
                    className={`px-3 py-2 text-sm border rounded-md ${
                      contentType.startsWith(type.mime)
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-700'
                        : 'bg-white text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* File Upload Area - Main Interaction Point */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                <Tooltip
                  content={
                    <div>
                      <p>Upload the file you want to inscribe on Bitcoin.</p>
                      <p className="mt-1">Supported types: text files, JSON, images (PNG, JPEG, SVG).</p>
                    </div>
                  }
                  position="top"
                  showIcon={true}
                >
                  Upload File
                </Tooltip>
              </label>
              
              {uploadedFileName ? (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 border-dashed rounded-lg flex items-center justify-between">
                  <div className="flex items-center">
                    <Check className="h-6 w-6 text-green-500 mr-3" />
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-300">{uploadedFileName}</p>
                      <p className="text-sm text-green-600 dark:text-green-400">File uploaded successfully</p>
                    </div>
                  </div>
                  <button 
                    onClick={clearUploadedFile}
                    className="ml-2 p-1 hover:bg-green-100 dark:hover:bg-green-800/30 rounded-full"
                    aria-label="Clear uploaded file"
                  >
                    <X className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-40 bg-gray-50 dark:bg-gray-800/50 border-2 border-gray-300 dark:border-gray-700 border-dashed rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 mb-3 text-gray-400 dark:text-gray-500" />
                    <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">SVG, PNG, JPG, Text or JSON</p>
                  </div>
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    className="hidden" 
                    onChange={handleFileUpload} 
                    accept=".txt,.json,.svg,.png,.jpg,.jpeg,text/plain,application/json,image/svg+xml,image/png,image/jpeg"
                  />
                </label>
              )}
              
              {/* Subtle way to create text content directly */}
              <div className="mt-3 flex items-center justify-center">
                <button 
                  type="button"
                  onClick={() => setShowDirectTextEditor(!showDirectTextEditor)}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 focus:outline-none flex items-center"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  {showDirectTextEditor ? 'Hide text editor' : 'Or create text directly'}
                </button>
              </div>
            </div>

            {showDirectTextEditor && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Direct Text Input
                </label>
                <textarea
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setUploadedFileName(null);
                  }}
                  placeholder={contentType.startsWith('text/plain') ? "Enter text..." : contentType.startsWith('application/json') ? "Enter JSON..." : "Paste base64 or data URL..."}
                  className="w-full h-32 p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 dark:bg-gray-700"
                />
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Tooltip
                  content={
                    <div>
                      <p>Optional metadata that will be stored with your inscription.</p>
                      <p className="mt-1">Must be valid JSON in key-value format: {`{"name": "value"}`}</p>
                      <p className="mt-1">Common fields: name, description, creator</p>
                    </div>
                  }
                  position="top"
                  showIcon={true}
                >
                  Metadata (optional)
                </Tooltip>
              </label>
              <textarea
                value={metadata}
                onChange={(e) => setMetadata(e.target.value)}
                placeholder='{"name": "My Inscription", "description": "A cool inscription"}'
                className="w-full h-20 p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 dark:bg-gray-700"
              />
            </div>

            <div className="mb-4">
              <FeeEstimator
                inscriptionSizeBytes={content ? new TextEncoder().encode(content).length : 0}
                onFeeCalculated={handleFeeCalculated}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handlePrepareInscription}
                disabled={!content || content.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Prepare Inscription
              </button>
            </div>
          </div>
        </div>
      );
    } else if (flowState === 'awaitingUtxoSelection') {
      stepContent = (
        <div className="space-y-4">
          <FeeEstimator 
            inscriptionSizeBytes={content ? new TextEncoder().encode(content).length : 0}
            utxoCount={selectedUtxos.length || 1}
            addressType="p2wpkh"
            includeChange={true}
            onFeeCalculated={handleFeeCalculated}
            className="mb-4"
          />
          <UtxoSelector
            walletConnected={walletConnected}
            utxos={availableUtxos}
            selectedUtxos={selectedUtxos}
            isFetchingUtxos={isFetchingUtxos}
            utxoError={utxoError}
            flowState={flowState}
            onFetchUtxos={handleFetchUtxos}
            onUtxoSelectionChange={handleUtxoSelectionChange}
            requiredAmount={inscriptionPrepData ? Number(inscriptionPrepData.requiredCommitAmount) : undefined}
          />
          {selectedUtxos.length > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">Total selected: {truncateMiddle(totalSelectedValue.toString(), 20)} sats</p>
          )}
        </div>
      );
    } else if (
      flowState === 'awaitingCommitSignature' || 
      flowState === 'broadcastingCommitTx' || 
      flowState === 'awaitingCommitConfirmation'
    ) {
      stepContent = (
        <div className="space-y-4">
          {inscriptionPrepData && (
            <>
              <div className="border rounded p-3 space-y-2 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold flex items-center"><Bitcoin className="h-4 w-4 mr-2" /> Commit Details</h4>
                <div className="text-sm space-y-1">
                  <div>
                    <label className="text-xs font-semibold block">Commit Address:</label>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm break-all">{inscriptionPrepData.commitAddress}</span>
                      <button title="Copy Address" onClick={() => handleCopy(inscriptionPrepData.commitAddress)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold block">Required Amount (Reveal Fee + Postage):</label>
                    <div className="font-mono text-sm">{inscriptionPrepData.requiredCommitAmount.toString()} sats</div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold block">Estimated Reveal Fee:</label>
                    <div className="font-mono text-sm">{inscriptionPrepData.revealFee.toString()} sats</div>
                  </div>
                </div>
              </div>

              <FeeEstimator 
                inscriptionSizeBytes={content ? new TextEncoder().encode(content).length : 0}
                utxoCount={selectedUtxos.length || 1}
                addressType="p2wpkh"
                includeChange={true}
                onFeeCalculated={handleFeeCalculated}
                className="mb-4"
              />

              <UtxoSelector
                walletConnected={walletConnected}
                utxos={availableUtxos}
                selectedUtxos={selectedUtxos}
                isFetchingUtxos={isFetchingUtxos}
                utxoError={utxoError}
                flowState={flowState}
                onFetchUtxos={handleFetchUtxos}
                onUtxoSelectionChange={handleUtxoSelectionChange}
                requiredAmount={inscriptionPrepData ? Number(inscriptionPrepData.requiredCommitAmount) : undefined}
              />
              {selectedUtxos.length > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">Total selected: {truncateMiddle(totalSelectedValue.toString(), 20)} sats</p>
              )}
            </>
          )}
          {['preparingCommitTx', 'awaitingCommitSignature', 'broadcastingCommitTx', 'awaitingCommitConfirmation'].includes(flowState) && (
            <div className="flex items-center justify-center text-gray-500 pt-4">
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              {statusMessage || 'Processing commit transaction...'}
            </div>
          )}
        </div>
      );
    } else if (
      flowState === 'commitConfirmedReadyForReveal' || 
      flowState === 'constructingRevealTx' || 
      flowState === 'broadcastingRevealTx' || 
      flowState === 'awaitingRevealConfirmation'
    ) {
      stepContent = (
        <div className="space-y-4">
          <div className="border rounded p-3 space-y-1 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700">
            <h4 className="font-semibold flex items-center text-green-800 dark:text-green-300"><CheckCircle className="h-4 w-4 mr-2" /> Commit Transaction Confirmed!</h4>
            <div className="text-sm text-green-700 dark:text-green-200">
              <p>Commit TXID: <span className="font-mono break-all">{finalCommitTxid}</span></p>
              <p>Commit VOUT: <span className="font-mono">{finalCommitVout ?? 'N/A'}</span></p>
              <p>Amount Sent: <span className="font-mono">{finalCommitAmount?.toString() ?? 'N/A'} sats</span></p>
              <p className="mt-2">Preparing to construct and broadcast the reveal transaction using the generated ephemeral key.</p>
            </div>
          </div>
          {(flowState === 'constructingRevealTx' || flowState === 'broadcastingRevealTx' || flowState === 'awaitingRevealConfirmation') && (
            <div className="flex items-center justify-center text-gray-500 pt-4">
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              {statusMessage || 'Processing reveal transaction...'}
            </div>
          )}
        </div>
      );
    } else if (flowState === 'inscriptionComplete') {
      stepContent = (
        <div className="space-y-4">
          <div className="border rounded p-3 space-y-1 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700">
            <h4 className="font-semibold flex items-center text-green-800 dark:text-green-300"><CheckCircle className="h-4 w-4 mr-2" /> Inscription Complete!</h4>
            <div className="text-sm text-green-700 dark:text-green-200 space-y-1">
              {commitTxidForDisplay && <p>Commit TX: <a href={`${blockExplorerUrl}/tx/${commitTxidForDisplay}`} target="_blank" rel="noopener noreferrer" className="font-mono underline hover:text-blue-700 dark:hover:text-blue-400 break-all">{truncateMiddle(commitTxidForDisplay, 10)} <ExternalLink className="inline-block h-3 w-3 ml-1" /></a></p>}
              {revealTxid && <p>Reveal TX: <a href={`${blockExplorerUrl}/tx/${revealTxid}`} target="_blank" rel="noopener noreferrer" className="font-mono underline hover:text-blue-700 dark:hover:text-blue-400 break-all">{truncateMiddle(revealTxid, 10)} <ExternalLink className="inline-block h-3 w-3 ml-1" /></a></p>}
              <p className="pt-2">Your inscription should appear shortly.</p>
            </div>
          </div>
        </div>
      );
    } else if (flowState === 'failed') {
      stepContent = (
        <div className="space-y-4">
          <div className="border rounded p-3 space-y-1 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700">
            <h4 className="font-semibold flex items-center text-red-800 dark:text-red-300"><AlertCircle className="h-4 w-4 mr-2" /> Error</h4>
            <div className="text-sm text-red-700 dark:text-red-200">
              {errorMessage || "An unknown error occurred."}
            </div>
          </div>
        </div>
      );
    } else {
      stepContent = (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <span className="ml-2 text-gray-700 dark:text-gray-300">{statusMessage || 'Processing...'}</span>
        </div>
      );
    }
    
    // Wrap the existing content with the StepIndicator
    return (
      <div className="space-y-6">
        {/* Only show step indicator if wallet is connected */}
        {walletConnected && (
          <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            <StepIndicator
              steps={inscriptionSteps}
              currentStepIndex={getCurrentStepIndex()}
              className="py-2"
            />
          </div>
        )}
        
        {/* Existing step content */}
        {stepContent}
      </div>
    );
  };

  const renderFooterActions = () => {
    if (!walletConnected) {
      return null;
    }

    // For most states, only show one primary action button
    if (flowState === 'preparingInscription' || 
        flowState === 'preparingCommitTx' || 
        flowState === 'broadcastingCommitTx' || 
        flowState === 'awaitingCommitConfirmation' || 
        flowState === 'constructingRevealTx' || 
        flowState === 'broadcastingRevealTx' || 
        flowState === 'awaitingRevealConfirmation') {
      return (
        <div className="flex justify-center mt-6">
          <button
            type="button"
            disabled={true}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 opacity-50 cursor-not-allowed"
          >
            <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
            {statusMessage || 'Processing...'}
          </button>
        </div>
      );
    }

    let buttonText = '';
    let buttonAction = () => {};
    let buttonDisabled = false;
    let canReset = true;

    if (flowState === 'idle' || flowState === 'awaitingContentType' || flowState === 'awaitingContent') {
      buttonText = 'Prepare Inscription';
      buttonAction = handlePrepareInscription;
      buttonDisabled = !content || content.length === 0;
      canReset = false; // No need to reset at the beginning
    } else if (flowState === 'awaitingUtxoSelection') {
      buttonText = 'Sign Commit Transaction';
      buttonAction = handlePrepareAndSignCommit;
      buttonDisabled = selectedUtxos.length === 0;
    } else if (flowState === 'awaitingCommitSignature') {
      buttonText = 'Broadcast Commit Transaction';
      buttonAction = confirmAndBroadcastCommit; // Use confirmation wrapper
      buttonDisabled = !signedCommitPsbt;
    } else if (flowState === 'commitConfirmedReadyForReveal') {
      buttonText = 'Create Inscription';
      buttonAction = confirmAndHandleCommitFunded; // Use confirmation wrapper
      buttonDisabled = false;
    } else if (flowState === 'inscriptionComplete') {
      // For completed state, offer to create another inscription
      return (
        <div className="flex justify-between mt-6">
          <a
            href={`${blockExplorerUrl}/tx/${revealTxid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            View Transaction <ExternalLink className="ml-2 h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={resetFlow}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Create Another Inscription
          </button>
        </div>
      );
    } else if (flowState === 'failed') {
      buttonText = 'Try Again';
      buttonAction = resetFlow;
      buttonDisabled = false;
    }

    return (
      <div className="flex justify-between mt-6">
        {canReset && (
          <button
            type="button"
            onClick={resetFlow}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Reset
          </button>
        )}
        <button
          type="button"
          onClick={buttonAction}
          disabled={buttonDisabled}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
            buttonDisabled 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
          }`}
        >
          {buttonText}
        </button>
      </div>
    );
  };

  // Update the UI to display errors with our new component
  const renderError = () => {
    if (!errorMessage) return null;
    
    // Create a basic error object if we don't have a structured one
    const errorObj = typeof errorMessage === 'string' 
      ? { message: errorMessage } as Error
      : errorMessage;
    
    return (
      <div className="my-4">
        <ErrorDisplay 
          error={errorObj} 
          onDismiss={() => setErrorMessage(null)}
          onRetry={flowState === 'failed' ? resetFlow : undefined}
          showDetails={true}
        />
      </div>
    );
  };

  const confirmAndBroadcastCommit = () => {
    setShowCommitConfirmation(true);
    setPendingAction(() => async () => {
      if (!signedCommitPsbt) return;
      await handleBroadcastCommit(walletNetwork || 'bitcoin', signedCommitPsbt);
    });
  };

  const confirmAndHandleCommitFunded = () => {
    setShowRevealConfirmation(true);
    setPendingAction(() => handleCommitFunded);
  };

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Create Ordinal Inscription
        </h1>
        
        {renderCurrentStep()}
        {renderFooterActions()}
        {renderError()}
        
        {/* Commit Transaction Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={showCommitConfirmation}
          onClose={() => setShowCommitConfirmation(false)}
          onConfirm={() => {
            setShowCommitConfirmation(false);
            if (pendingAction) pendingAction();
          }}
          title="Broadcast Commit Transaction"
          message={
            <div>
              <p>You are about to broadcast the commit transaction to the Bitcoin network.</p>
              <p className="mt-2">This is the first step of a two-step inscription process and will require a network fee.</p>
              {calculatedCommitFee ? (
                <p className="mt-2 font-medium">Estimated fee: {(Number(calculatedCommitFee.toString()) / 100000000).toFixed(8)} BTC</p>
              ) : null}
            </div>
          }
          confirmText="Broadcast Transaction"
          cancelText="Cancel"
          type="warning"
        />
        
        {/* Reveal Transaction Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={showRevealConfirmation}
          onClose={() => setShowRevealConfirmation(false)}
          onConfirm={() => {
            setShowRevealConfirmation(false);
            if (pendingAction) pendingAction();
          }}
          title="Create Inscription"
          message={
            <div>
              <p>You are about to create your ordinals inscription by broadcasting the reveal transaction.</p>
              <p className="mt-2">This is the final step of the inscription process and cannot be undone.</p>
              <p className="mt-2">Your inscription will be permanently recorded on the Bitcoin blockchain.</p>
            </div>
          }
          confirmText="Create Inscription"
          cancelText="Cancel"
          type="warning"
        />
      </div>
    </div>
  );
};

export default ResourceCreationForm;
