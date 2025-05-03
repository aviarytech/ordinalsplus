import React, { useState, useEffect, useCallback } from 'react';
import { bytesToHex } from '@noble/hashes/utils';
import { Loader2, AlertCircle, CheckCircle, Copy, ExternalLink, Bitcoin } from 'lucide-react';
import * as ordinalsplus from 'ordinalsplus';
import * as btc from '@scure/btc-signer';
import { useWallet } from '../../context/WalletContext';
import { useApi } from '../../context/ApiContext';
import { useToast } from '../../contexts/ToastContext';
import ErrorDisplay from '../ui/ErrorDisplay';
import { StepIndicator, Tooltip, ConfirmationDialog } from '../ui';
import { InscriptionError, ErrorCategory, ErrorCode, ErrorSeverity } from '../../types/error';
import FeeEstimator from '../fee/FeeEstimator';
import { utils as secpUtils } from '@noble/secp256k1';
import { schnorr } from '@noble/curves/secp256k1';
import { OrdinalInscription, PreparedInscription } from '../../../../ordinalsplus/src/inscription/scripts/ordinal-reveal';

// --- Local Definitions (Fallback for utils not exported from library) ---
const getNetworkLabel = (network: string | null | undefined): string => {
  if (!network) return 'Unknown';
  if (network === 'testnet') return 'Testnet';
  if (network === 'signet') return 'Signet';
  return 'Mainnet';
};
const truncateMiddle = (str: string | null, length = 10): string => {
  if (!str) return '';
  if (str.length <= length * 2 + 3) return str;
  return `${str.substring(0, length)}...${str.substring(str.length - length)}`;
};

// Define supported content types
const supportedContentTypes = [
  { mime: 'text/plain', label: 'Text', isText: true },
  { mime: 'application/json', label: 'JSON', isText: true },
  { mime: 'image/png', label: 'PNG Image', isText: false },
  { mime: 'image/jpeg', label: 'JPEG Image', isText: false },
  { mime: 'image/svg+xml', label: 'SVG Image', isText: false },
];

// Define constants locally
const POSTAGE_VALUE = 1000n; // Use bigint
const DUST_LIMIT = 546n;    // Use bigint

// Define simplified flow states
type FlowState =
  | 'idle'
  | 'awaitingContentType'
  | 'awaitingContent'
  | 'preparingInscription'
  | 'awaitingFunding'       // New state: Waiting for user to fund the commit address
  | 'awaitingFundingTxid' // New state: Waiting for user to provide the funding txid
  | 'constructingRevealTx'
  | 'broadcastingRevealTx'
  | 'awaitingRevealConfirmation'
  | 'inscriptionComplete'
  | 'failed';

// Simplified interface for prepared data
interface InscriptionPrepData {
  contentType: string;
  requiredCommitAmount: bigint;
  revealFee: bigint;
  preparedInscription: PreparedInscription;
}

/**
 * SimpleResourceCreationForm orchestrates a simplified resource creation flow.
 * It shows the user an address/amount to fund and asks for the funding TXID.
 */
const SimpleResourceCreationForm: React.FC = () => {
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
  const [fundingTxidInput, setFundingTxidInput] = useState<string>(''); // User input for funding txid
  const [showRevealConfirmation, setShowRevealConfirmation] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [ephemeralKeyData, setEphemeralKeyData] = useState<{ revealPrivateKeyWif: string; revealPublicKeyBytes: Uint8Array } | null>(null);
  const [finalRevealTxid, setFinalRevealTxid] = useState<string | null>(null);
  const [finalRevealTxHex, setFinalRevealTxHex] = useState<string | null>(null);
  const [revealComplete, setRevealComplete] = useState<boolean>(false);

  const {
    connected: walletConnected,
    address: walletAddress,
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

  const BTC_NETWORK = walletNetwork ? getOrdinalsPlusNetwork(walletNetwork) : 'mainnet';
  const scureNetwork = walletNetwork ? ordinalsplus.getScureNetwork(walletNetwork as any) : ordinalsplus.NETWORKS.bitcoin;
  const networkLabel = walletNetwork ? getNetworkLabel(walletNetwork) : 'Mainnet';
  const blockExplorerUrl = walletNetwork === 'testnet'
    ? 'https://mempool.space/testnet'
    : 'https://mempool.space';
  const currentFeeRate = feeRateInput;

  // Define simplified steps for the inscription process
  const inscriptionSteps = [
    { id: 'content', label: 'Content', description: 'Configure inscription' },
    { id: 'fund', label: 'Fund', description: 'Provide funding TXID' },
    { id: 'reveal', label: 'Reveal', description: 'Create inscription' },
    { id: 'complete', label: 'Complete', description: 'View inscription' },
  ];

  // Determine current step index based on the simplified flow state
  const getCurrentStepIndex = (): number => {
    switch (flowState) {
      case 'idle':
      case 'awaitingContentType':
      case 'awaitingContent':
      case 'preparingInscription':
        return 0; // Content step
      case 'awaitingFunding':
      case 'awaitingFundingTxid':
        return 1; // Fund step
      case 'constructingRevealTx':
      case 'broadcastingRevealTx':
      case 'awaitingRevealConfirmation':
        return 2; // Reveal step
      case 'inscriptionComplete':
        return 3; // Complete step
      case 'failed':
        // For failed state, return the step where the failure likely occurred
        if (finalRevealTxid || revealTxid) return 3; // Failed after reveal started
        if (fundingTxidInput) return 2; // Failed during reveal construction
        if (inscriptionPrepData) return 1; // Failed after prep, during funding
        return 0; // Failed during content/prep
      default:
        return 0;
    }
  };

  useEffect(() => {
    if (!walletConnected) {
      resetFlow();
    }
  }, [walletConnected]);

  const resetFlow = () => {
    console.log("[ResetFlow] Resetting state...");
    setContentType('text/plain;charset=utf-8');
    setContent('');
    setMetadata('');
    setFeeRateInput(10);
    setFlowState('idle');
    setErrorMessage(null);
    setStatusMessage(null);
    setInscriptionPrepData(null);
    setEphemeralRevealPrivateKeyWif(null);
    setRevealTxid(null);
    setFundingTxidInput('');
    setShowRevealConfirmation(false);
    setIsLoading(false);
    setEphemeralKeyData(null);
    setFinalRevealTxid(null);
    setFinalRevealTxHex(null);
    setRevealComplete(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addToast('Copied to clipboard!', 'info');
    }).catch(err => {
      console.error("Failed to copy:", err);
      addErrorToast(createError('COPY_FAILED', 'Could not copy to clipboard.'));
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

  const createError = (
    code: ErrorCode | string,
    message: string,
    details?: string,
    category: ErrorCategory = ErrorCategory.INSCRIPTION
  ): InscriptionError => {
    return {
      code: code as ErrorCode,
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

  // Step 1: Prepare Inscription - Calculate details and show funding info
  const handlePrepareInscription = async () => {
    console.log("[PrepareInscription] Starting preparation...");
    setFlowState('preparingInscription');
    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage('Generating ephemeral key and preparing inscription data...');
    setInscriptionPrepData(null);
    setEphemeralRevealPrivateKeyWif(null);

    if (!walletAddress) {
      const error = createError('WALLET_NOT_CONNECTED', 'Wallet address is missing.', undefined, ErrorCategory.WALLET);
      setErrorMessage(error.message);
      addErrorToast(error);
      setFlowState('failed');
      setIsLoading(false);
      return;
    }

    try {
      console.log("[PrepareInscription] Generating ephemeral keypair...");
      const revealPrivateKeyBytes = secpUtils.randomPrivateKey();
      const revealPublicKeyBytes = btc.utils.pubSchnorr(revealPrivateKeyBytes);
      const revealKeyWif = bytesToHex(revealPrivateKeyBytes);
      setEphemeralRevealPrivateKeyWif(revealKeyWif);
      setEphemeralKeyData({ revealPrivateKeyWif: revealKeyWif, revealPublicKeyBytes });
      console.log(`[PrepareInscription] Ephemeral Public Key generated: ${bytesToHex(revealPublicKeyBytes)}`);

      const parsedMeta = parseMetadata(metadata);

      console.log("[PrepareInscription] Preparing inscription data using createInscription...");
      // Use the properly exported createInscription function
      const preparedInscription = ordinalsplus.createInscription({
        content: content,
        contentType: contentType,
        metadata: parsedMeta,
        revealPublicKey: revealPublicKeyBytes, // Provide the generated public key
        network: BTC_NETWORK
      });

      const safetyBufferFeeRate = currentFeeRate + 0.1;
      console.log(`[PrepareInscription] Using fee rate with safety buffer: ${safetyBufferFeeRate} sats/vB`);

      const revealFee = ordinalsplus.calculateFee(Buffer.from(content).length, safetyBufferFeeRate);
      console.log(`[PrepareInscription] Estimated reveal fee: ${revealFee} sats`);

      const requiredCommitAmount = BigInt(revealFee) + POSTAGE_VALUE;
      console.log(`[PrepareInscription] Required commit amount: ${requiredCommitAmount} sats`);

      setInscriptionPrepData({
        contentType,
        requiredCommitAmount,
        revealFee: BigInt(revealFee),
        preparedInscription: preparedInscription // Store the full object
      });

      setStatusMessage('Inscription prepared. Please fund the address below.');
      setFlowState('awaitingFunding');

    } catch (error) {
      console.error("[PrepareInscription] Error:", error);
      const structuredError = error instanceof Error
          ? createError('INSCRIPTION_PREPARATION_FAILED', error.message)
          : createError('UNKNOWN_ERROR', 'Unknown error during preparation.', String(error));
      setErrorMessage(structuredError.message);
      addErrorToast(structuredError);
      setFlowState('failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: User provides funding TXID, proceed to reveal
  const handleFundingTxidProvided = () => {
    if (!fundingTxidInput || !/^[a-fA-F0-9]{64}$/.test(fundingTxidInput)) {
      const error = createError('INVALID_INPUT', 'Please enter a valid 64-character transaction ID (hex).', undefined, ErrorCategory.VALIDATION);
      setErrorMessage(error.message);
      addErrorToast(error);
      return;
    }
    console.log(`[FundingTxidProvided] User entered funding TXID: ${fundingTxidInput}`);
    // setFinalRevealTxid(fundingTxidInput); // Don't set final reveal txid here yet
    confirmAndHandleReveal();
  };

  const handleBroadcastReveal = async (revealTxHex: string) => {
    try {
      console.log("[BroadcastReveal] Starting broadcast...");
      setIsLoading(true);
      setErrorMessage(null);
      setStatusMessage('Broadcasting reveal transaction...');
      setFlowState('broadcastingRevealTx');

      if (!apiService || !walletNetwork) {
        throw new Error('API service or network not available');
      }

      const response = await apiService.broadcastTransaction(walletNetwork, revealTxHex);
      const txid = typeof response === 'object' && response !== null ? response.txid : response;
      console.log(`[BroadcastReveal] Reveal transaction broadcast with txid: ${txid}`);
      setFinalRevealTxid(txid); // Set the *actual* final reveal TXID here
      setRevealTxid(txid); // Also update the display TXID
      setFinalRevealTxHex(revealTxHex);
      setStatusMessage('Reveal transaction broadcast. Waiting for confirmation...');
      setFlowState('awaitingRevealConfirmation');

      addToast(
        `Reveal TX broadcast: ${truncateMiddle(txid, 8)}`,
        'success',
        5000
      );

      // Simulate confirmation delay for better UX, then mark as complete
      setTimeout(() => {
        setStatusMessage('Inscription completed successfully!');
        setFlowState('inscriptionComplete');
        setRevealComplete(true);
        addToast('Inscription successfully created!', 'success', 5000);
      }, 3000);

      return txid;
    } catch (error) {
      console.error("[BroadcastReveal] Error broadcasting reveal transaction:", error);
      const errorObj = createError(
        ErrorCode.TRANSACTION_FAILED,
        'Failed to broadcast reveal transaction',
        (error as Error).message,
        ErrorCategory.NETWORK
      );
      setErrorMessage(errorObj.message);
      addErrorToast(errorObj);
      setFlowState('failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Construct and Broadcast Reveal Transaction
  const handleConstructAndBroadcastReveal = async () => {
    console.log("[ConstructAndBroadcastReveal] Starting reveal step...");
    setErrorMessage(null);

    if (!fundingTxidInput || !inscriptionPrepData || !ephemeralRevealPrivateKeyWif || !ephemeralKeyData) {
      setErrorMessage("Funding TXID, prep data, or ephemeral reveal key missing.");
      setFlowState('failed');
      return;
    }

    console.log(`[ConstructAndBroadcastReveal] Using funding TXID: ${fundingTxidInput}`);

    try {
      setFlowState('constructingRevealTx');
      setIsLoading(true);
      setStatusMessage('Constructing final reveal transaction...');

      const ephemeralPrivateKeyBytes = Uint8Array.from(
        Buffer.from(ephemeralRevealPrivateKeyWif, 'hex')
      );

      console.log(`[ConstructAndBroadcastReveal] Creating reveal transaction with ephemeral key`);

      const revealTxResult = await ordinalsplus.createRevealTransaction({
        selectedUTXO: {
          txid: fundingTxidInput,
          vout: 0,
          value: Number(inscriptionPrepData.requiredCommitAmount),
          script: { type: 'p2tr', address: inscriptionPrepData.preparedInscription.commitAddress.address }
        },
        preparedInscription: inscriptionPrepData.preparedInscription,
        privateKey: ephemeralPrivateKeyBytes,
        feeRate: currentFeeRate,
        network: scureNetwork,
        commitTransactionId: fundingTxidInput
      });

      console.log(`[ConstructAndBroadcastReveal] Reveal TX constructed. Txid: ${revealTxResult.tx.id}`);
      setRevealTxid(revealTxResult.tx.id);

      await handleBroadcastReveal(revealTxResult.hex);

    } catch (error) {
      console.error("[ConstructAndBroadcastReveal] Error:", error);
      const message = error instanceof Error ? error.message : String(error);
      let structuredError: InscriptionError;

      if (message.includes('sendrawtransaction RPC error') || message.includes('broadcast error')) {
        structuredError = createError(
          ErrorCode.TRANSACTION_FAILED,
          'Failed to broadcast reveal transaction.',
          `Network error: ${message}`,
          ErrorCategory.NETWORK
        );
      } else if (message.includes('insufficient funds') || message.includes('too low') || message.includes('fee')) {
        structuredError = createError(
          ErrorCode.INSUFFICIENT_FUNDS,
          'Insufficient funds for reveal.',
          `Funding transaction might not have confirmed, amount incorrect, or fee too low: ${message}`,
          ErrorCategory.WALLET
        );
      } else if (message.includes('non-final') || message.includes('txn-mempool-conflict')) {
        structuredError = createError(
            ErrorCode.TRANSACTION_REJECTED,
            'Transaction conflict or not final.',
            'The funding transaction might not be confirmed yet. Please wait and try again.',
            ErrorCategory.NETWORK
        );
      } else if (message.includes('bad-txns-inputs-missingorspent') || message.includes('Missing input')) {
        structuredError = createError(
            ErrorCode.INVALID_UTXO,
            'Funding UTXO missing or already spent.',
            'Please double-check the funding transaction ID and ensure it is confirmed and unspent.',
            ErrorCategory.VALIDATION
        );
      } else {
        structuredError = createError(
            ErrorCode.REVEAL_TX_FAILED,
            'Reveal process failed.',
            message,
            ErrorCategory.INSCRIPTION
        );
      }

      setErrorMessage(structuredError.message);
      addErrorToast(structuredError);
      setFlowState('failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeeCalculated = (fees: {
    commitFee: number;
    revealFee: number;
    totalFee: number;
    minimumRequiredAmount: number;
    commitTxSize?: number;
    revealTxSize?: number;
  } | null) => {
    if (fees) {
      const effectiveRate = fees.revealTxSize ? Math.max(1, Math.round(fees.revealFee / fees.revealTxSize)) : currentFeeRate;
      setFeeRateInput(effectiveRate);
      console.log(`[FeeEstimator] Reveal Fee: ${fees.revealFee} sats, Effective Rate: ${effectiveRate} sats/vB, Min Required: ${fees.minimumRequiredAmount} sats`);
    }
  };

  const renderCurrentStep = () => {
    let stepContent;

    if (!walletConnected) {
      stepContent = (
        <div className="text-center p-6">
          <Bitcoin className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Connect Your Wallet</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Please connect your wallet to create an inscription</p>
        </div>
      );
    } else if (flowState === 'idle' || flowState === 'awaitingContentType' || flowState === 'awaitingContent') {
      // Step 1: Content Input
      stepContent = (
        <div className="space-y-4">
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
            {/* Content Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content Type</label>
              <div className="flex flex-wrap gap-2">
                {supportedContentTypes.map((type) => (
                  <button
                    key={type.mime}
                    type="button"
                    onClick={() => setContentType(type.isText ? `${type.mime};charset=utf-8` : type.mime)}
                    className={`px-3 py-2 text-sm border rounded-md ${contentType.startsWith(type.mime) ? 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-700' : 'bg-white text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'}`}
                  >{type.label}</button>
                ))}
              </div>
            </div>
            {/* Content Input Area */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={contentType.startsWith('text/plain') ? "Enter text..." : contentType.startsWith('application/json') ? "Enter JSON..." : "Paste base64 or data URL..."}
                className="w-full h-32 p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 dark:bg-gray-700 font-mono text-xs"
              />
            </div>
            {/* Metadata Input Area */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Metadata (optional JSON)</label>
              <textarea
                value={metadata}
                onChange={(e) => setMetadata(e.target.value)}
                placeholder='{"name": "My Inscription", "description": "A cool inscription"}'
                className="w-full h-20 p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 dark:bg-gray-700 font-mono text-xs"
              />
            </div>
            {/* Fee Estimator */}
            <div className="mb-4">
              <FeeEstimator
                inscriptionSizeBytes={content ? new TextEncoder().encode(content).length : 0}
                onFeeCalculated={handleFeeCalculated}
                // Simplified Fee Estimator Props for this form
                utxoCount={1} // Assume 1 input for reveal
                addressType="p2tr" // Target is P2TR
                includeChange={false} // Reveal tx likely won't have change output from funding UTXO
              />
            </div>
            {/* Action Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handlePrepareInscription}
                disabled={!content || content.length === 0 || isLoading}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                Prepare Inscription
              </button>
            </div>
          </div>
        </div>
      );
    } else if (flowState === 'awaitingFunding') {
      // Step 2a: Show Funding Instructions
      stepContent = (
        <div className="space-y-4">
          <div className="p-4 border border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 rounded-md">
            <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-3">Step 2: Fund the Inscription</h3>
            <p className="text-yellow-700 dark:text-yellow-100 mb-4">Please send the exact amount specified below to the provided Bitcoin address. This transaction will fund the creation of your inscription.</p>
            {inscriptionPrepData && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Send EXACTLY this amount:</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">{inscriptionPrepData.requiredCommitAmount.toString()}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">sats</span>
                    <button title="Copy Amount" onClick={() => handleCopy(inscriptionPrepData.requiredCommitAmount.toString())} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><Copy className="h-3 w-3" /></button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">To this Bitcoin address:</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="font-mono text-sm break-all text-gray-900 dark:text-gray-100">{inscriptionPrepData.preparedInscription.commitAddress.address}</span>
                    <button title="Copy Address" onClick={() => handleCopy(inscriptionPrepData.preparedInscription.commitAddress.address)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><Copy className="h-3 w-3" /></button>
                  </div>
                </div>
                <p className="text-xs text-yellow-600 dark:text-yellow-300 pt-2">⚠️ Important: Send the exact amount in a single transaction. Do NOT send from an exchange. Once sent, copy the Transaction ID (TXID).</p>
              </div>
            )}
            {/* Transition button */}
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setFlowState('awaitingFundingTxid')}
                className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                I Have Sent the Funds
              </button>
            </div>
          </div>
        </div>
      );
    } else if (flowState === 'awaitingFundingTxid') {
       // Step 2b: Ask for Funding TXID
       stepContent = (
        <div className="space-y-4">
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
             <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Enter Funding Transaction ID</h3>
             <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Paste the Transaction ID (TXID) of the transaction you used to send funds to the address provided in the previous step.</p>
             <div>
                <label htmlFor="fundingTxid" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Funding TXID</label>
                <input
                  id="fundingTxid"
                  type="text"
                  value={fundingTxidInput}
                  onChange={(e) => setFundingTxidInput(e.target.value.trim())}
                  placeholder="Enter the 64-character hex transaction ID"
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 dark:bg-gray-700 font-mono text-sm"
                />
             </div>
             <div className="flex justify-between mt-4">
               <button
                  type="button"
                  onClick={() => setFlowState('awaitingFunding')}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
               >
                  Back
               </button>
               <button
                  type="button"
                  onClick={handleFundingTxidProvided}
                  disabled={!fundingTxidInput || fundingTxidInput.length !== 64 || isLoading}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                  Confirm TXID & Create Inscription
               </button>
             </div>
          </div>
        </div>
      );
    } else if (flowState === 'constructingRevealTx' || flowState === 'broadcastingRevealTx' || flowState === 'awaitingRevealConfirmation') {
      // Step 3: Processing Reveal
      stepContent = (
        <div className="space-y-4">
          <div className="p-4 border rounded border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30">
            <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">Step 3: Creating Inscription</h3>
            <div className="flex items-center justify-center text-blue-700 dark:text-blue-300 pt-4">
              <Loader2 className="animate-spin mr-2 h-5 w-5" />
              <span>{statusMessage || 'Processing reveal transaction...'}</span>
            </div>
             {fundingTxidInput && <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Using Funding TXID: {truncateMiddle(fundingTxidInput, 10)}</p>}
          </div>
        </div>
      );
    } else if (flowState === 'inscriptionComplete') {
      // Step 4: Completion
      stepContent = (
        <div className="space-y-4">
          <div className="p-4 border rounded border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/30">
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2"><CheckCircle className="inline h-5 w-5 mr-1" /> Inscription Complete!</h3>
            <div className="text-sm text-green-700 dark:text-green-200 space-y-1">
              {fundingTxidInput && <p>Funding TX: <a href={`${blockExplorerUrl}/tx/${fundingTxidInput}`} target="_blank" rel="noopener noreferrer" className="font-mono underline hover:text-blue-700 dark:hover:text-blue-400 break-all">{truncateMiddle(fundingTxidInput, 10)} <ExternalLink className="inline-block h-3 w-3 ml-1" /></a></p>}
              {revealTxid && <p>Reveal TX (Inscription): <a href={`${blockExplorerUrl}/tx/${revealTxid}`} target="_blank" rel="noopener noreferrer" className="font-mono underline hover:text-blue-700 dark:hover:text-blue-400 break-all">{truncateMiddle(revealTxid, 10)} <ExternalLink className="inline-block h-3 w-3 ml-1" /></a></p>}
              <p className="pt-2">Your inscription is broadcast and should appear in explorers shortly.</p>
            </div>
          </div>
        </div>
      );
    } else if (flowState === 'failed') {
      // Failed State
      stepContent = (
        <div className="space-y-4">
          <div className="p-4 border rounded border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/30">
             <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2"><AlertCircle className="inline h-5 w-5 mr-1" /> Error</h3>
             <div className="text-sm text-red-700 dark:text-red-200">
               {errorMessage || "An unknown error occurred."}
             </div>
          </div>
        </div>
      );
    } else {
      // Loading State (shouldn't happen often with specific isLoading flag)
      stepContent = (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <span className="ml-2 text-gray-700 dark:text-gray-300">{statusMessage || 'Processing...'}</span>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {walletConnected && (
          <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            <StepIndicator
              steps={inscriptionSteps}
              currentStepIndex={getCurrentStepIndex()}
              className="py-2"
            />
          </div>
        )}
        {stepContent}
      </div>
    );
  };

  const renderFooterActions = () => {
    if (!walletConnected || flowState === 'preparingInscription' || flowState === 'constructingRevealTx' || flowState === 'broadcastingRevealTx' || flowState === 'awaitingRevealConfirmation') {
      return null; // No actions needed during processing, or handled within step content
    }

    let mainAction: React.ReactNode = null;
    const showReset = flowState !== 'idle' && flowState !== 'awaitingContentType' && flowState !== 'awaitingContent';

    if (flowState === 'inscriptionComplete' || flowState === 'failed') {
      mainAction = (
        <button
          type="button"
          onClick={resetFlow}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {flowState === 'failed' ? 'Try Again' : 'Create Another Inscription'}
        </button>
      );
    } else if (flowState === 'awaitingFunding' || flowState === 'awaitingFundingTxid') {
      // Actions are handled within the step content for these states
      return null;
    }
    // Note: Initial 'Prepare Inscription' button is rendered inside renderCurrentStep

    return (
      <div className={`flex mt-6 ${showReset ? 'justify-between' : 'justify-end'}`}>
        {showReset && (
          <button
            type="button"
            onClick={resetFlow}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Reset
          </button>
        )}
        {mainAction}
      </div>
    );
  };

  const renderError = () => {
    if (!errorMessage) return null;
    const errorObj = typeof errorMessage === 'string' ? { message: errorMessage } as Error : errorMessage;
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

  // Confirmation dialog trigger for reveal step
  const confirmAndHandleReveal = () => {
    setShowRevealConfirmation(true);
    // The actual action handleConstructAndBroadcastReveal will be called on confirm
  };

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Create Ordinal Inscription (Simple)
        </h1>

        {renderCurrentStep()}
        {renderFooterActions()}
        {renderError()}

        {/* Reveal Transaction Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={showRevealConfirmation}
          onClose={() => setShowRevealConfirmation(false)}
          onConfirm={() => {
            setShowRevealConfirmation(false);
            handleConstructAndBroadcastReveal(); // Call the reveal function directly
          }}
          title="Create Inscription (Final Step)"
          message={
            <div>
              <p>You are about to broadcast the reveal transaction using the funding TXID you provided.</p>
              <p className="mt-2 font-medium">Funding TXID: <span className="font-mono text-xs break-all">{fundingTxidInput}</span></p>
              <p className="mt-2">This will permanently create the inscription on the Bitcoin blockchain.</p>
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

export default SimpleResourceCreationForm; 