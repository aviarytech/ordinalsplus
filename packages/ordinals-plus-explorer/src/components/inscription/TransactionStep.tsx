import React, { useState, useEffect, useCallback } from 'react';
import { useResourceInscription } from './ResourceInscriptionWizard';
import { useWallet, Utxo } from '../../context/WalletContext';
import { useApi } from '../../context/ApiContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui';
import { Loader2, AlertCircle, CheckCircle, Copy, ExternalLink, Info, Edit, Check } from 'lucide-react';
import UtxoSelector from '../create/UtxoSelector';
import * as ordinalsplus from 'ordinalsplus';
import * as btc from '@scure/btc-signer';
import { utils as secpUtils } from '@noble/secp256k1';
import { getScureNetwork } from 'ordinalsplus';

/**
 * TransactionStep handles the creation, signing, and broadcasting of the resource inscription transaction.
 */
const TransactionStep: React.FC = () => {
  const { state, setUtxoSelection: setUtxoSelectionState, setTransactionInfo, nextStep, previousStep, setError, clearError } = useResourceInscription();
  const { 
    connected: walletConnected,
    address: walletAddress,
    signPsbt,
    getUtxos,
    network: walletNetwork
  } = useWallet();
  
  // Helper function to update UTXO selection in the wizard state
  const setUtxoSelection = (utxos: Utxo[] | ((prev: Utxo[]) => Utxo[])) => {
    if (typeof utxos === 'function') {
      const newUtxos = utxos(state.utxoSelection);
      // Use the context function to update the state
      setUtxoSelectionState(newUtxos);
    } else {
      // Use the context function to update the state
      setUtxoSelectionState(utxos);
    }
  };
  const { apiService } = useApi();
  const { addToast, addErrorToast } = useToast();
  
  // Local state for transaction processing
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unsignedPsbt, setUnsignedPsbt] = useState<string | null>(null);
  const [signedPsbt, setSignedPsbt] = useState<string | null>(null);
  const [commitTxid, setCommitTxid] = useState<string | null>(state.transactionInfo.commitTx);
  const [revealTxid, setRevealTxid] = useState<string | null>(state.transactionInfo.revealTx);
  
  // Fee rate selection state
  const [selectedFeeRate, setSelectedFeeRate] = useState<number>(10);
  const [feeRateMode, setFeeRateMode] = useState<'low' | 'medium' | 'high' | 'custom'>('medium');
  
  // UTXO selection state
  const [availableUtxos, setAvailableUtxos] = useState<Utxo[]>([]);
  const [isFetchingUtxos, setIsFetchingUtxos] = useState<boolean>(false);
  const [utxoError, setUtxoError] = useState<string | null>(null);
  const [showUtxoGuidance, setShowUtxoGuidance] = useState<boolean>(false);
  const [requiredAmount, setRequiredAmount] = useState<number>(0);
  const [manualSelectionMode, setManualSelectionMode] = useState<boolean>(false);
  
  // Find the largest UTXO from the available UTXOs
  const findLargestUtxo = (utxos: Utxo[]): Utxo | null => {
    if (!utxos || utxos.length === 0) return null;
    
    return utxos.reduce((largest, current) => {
      return current.value > largest.value ? current : largest;
    }, utxos[0]);
  };
  
  // Find UTXOs that together meet the required amount, starting with the largest ones
  const findUtxosForAmount = (utxos: Utxo[], requiredAmount: number): Utxo[] => {
    if (!utxos || utxos.length === 0) return [];
    
    // Sort UTXOs by value in descending order
    const sortedUtxos = [...utxos].sort((a, b) => b.value - a.value);
    
    const selectedUtxos: Utxo[] = [];
    let totalValue = 0;
    
    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo);
      totalValue += utxo.value;
      
      if (totalValue >= requiredAmount) {
        break;
      }
    }
    
    return selectedUtxos;
  };
  
  // Get block explorer URL based on network
  const blockExplorerUrl = walletNetwork === 'testnet'
    ? 'https://mempool.space/testnet'
    : 'https://mempool.space';
  
  // Fetch UTXOs from wallet
  const handleFetchUtxos = async () => {
    if (!walletConnected) {
      setUtxoError('Wallet not connected');
      return;
    }
    
    if (!walletAddress) {
      setUtxoError('Wallet address not available');
      return;
    }
    
    setIsFetchingUtxos(true);
    setUtxoError(null);
    
    try {
      const utxos = await getUtxos();
      
      if (utxos.length === 0) {
        setUtxoError('No UTXOs found in your wallet');
      } else {
        setAvailableUtxos(utxos);
        
        // Automatically select UTXOs if not in manual mode
        if (!manualSelectionMode && state.utxoSelection.length === 0 && requiredAmount > 0) {
          // If we have a required amount, select UTXOs that meet that amount
          const selectedUtxos = findUtxosForAmount(utxos, requiredAmount);
          if (selectedUtxos.length > 0) {
            setUtxoSelection(selectedUtxos);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching UTXOs:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch UTXOs from wallet';
      setUtxoError(errorMessage);
    } finally {
      setIsFetchingUtxos(false);
    }
  };
  
  // Handle UTXO selection change
  const handleUtxoSelectionChange = (utxo: Utxo, isSelected: boolean) => {
    setUtxoSelection(prevSelected => {
      if (isSelected) {
        return prevSelected.some(u => u.txid === utxo.txid && u.vout === utxo.vout)
          ? prevSelected
          : [...prevSelected, utxo];
      } else {
        return prevSelected.filter(u => !(u.txid === utxo.txid && u.vout === utxo.vout));
      }
    });
    setUtxoError(null);
  };
  
  // Toggle between automatic and manual selection modes
  const toggleSelectionMode = () => {
    const newMode = !manualSelectionMode;
    setManualSelectionMode(newMode);
    
    // If switching back to automatic mode and we have UTXOs, select UTXOs that meet the required amount
    if (!newMode && availableUtxos.length > 0 && requiredAmount > 0) {
      const selectedUtxos = findUtxosForAmount(availableUtxos, requiredAmount);
      if (selectedUtxos.length > 0) {
        setUtxoSelection(selectedUtxos);
      }
    }
  };
  
  const handlePrepareAndSignCommit = async () => {
    if (!walletConnected || !walletAddress || !state.utxoSelection || state.utxoSelection.length === 0) {
      setErrorMessage('Please connect your wallet and select UTXOs first');
      return;
    }
    
    // Validate UTXO selection
    if (!state.utxoSelection || state.utxoSelection.length === 0) {
      setErrorMessage('No UTXOs selected. Please select at least one UTXO.');
      return;
    }
    
    setIsLoading(true);
    setStatusMessage('Preparing commit transaction...');
    setErrorMessage(null);
    
    try {
      // Map selected UTXOs to the format expected by ordinalsplus
      const utxosForApi = state.utxoSelection.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        ...(utxo.scriptPubKey && { scriptPubKey: utxo.scriptPubKey }) // Only include if available
      }));
      
      // Retrieve inscription data from localStorage
      const inscriptionDataStr = localStorage.getItem('inscriptionData');
      if (!inscriptionDataStr) {
        throw new Error('Inscription data not found. Please restart the inscription process.');
      }
      
      const inscriptionData = JSON.parse(inscriptionDataStr);
      
      // Convert hex strings back to Uint8Arrays
      const commitScript = new Uint8Array(Buffer.from(inscriptionData.commitScriptHex, 'hex'));
      const revealPublicKey = new Uint8Array(Buffer.from(inscriptionData.revealPublicKeyHex, 'hex'));
      
      // Calculate reveal transaction fee based on content size
      const content = state.contentData.content || '';
      const contentSizeBytes = Buffer.from(content).length;
      
      // Use the EXACT same calculation as the ordinalsplus library (corrected version)
      // This matches the fixed logic in packages/ordinalsplus/src/transactions/reveal-transaction.ts
      let estimatedVsize: number;
      if (contentSizeBytes > 0) {
        // Base transaction size (non-witness data)
        const baseSize = 150;
        
        // Witness data includes:
        // - Signature: ~64 bytes
        // - Inscription script: inscription content + ~200 bytes overhead
        // - Control block: ~33 bytes
        const witnessSize = contentSizeBytes + 300;
        
        // vsize = (base_size * 3 + total_size) / 4
        // where total_size = base_size + witness_size
        const totalSize = baseSize + witnessSize;
        estimatedVsize = Math.ceil((baseSize * 3 + totalSize) / 4);
      } else {
        // For non-inscription transactions, use a simpler calculation
        estimatedVsize = 200;
      }
      
      // Calculate fee using ordinalsplus calculateFee function
      let revealFee: number;
      let revealTxVSize: number;
      
      revealFee = Number(ordinalsplus.calculateFee(estimatedVsize, selectedFeeRate));
      revealTxVSize = estimatedVsize;
      
      // Prepare the commit transaction
      const commitResult = await ordinalsplus.prepareCommitTransaction({
        inscription: {
          commitAddress: {
            address: inscriptionData.commitAddress,
            script: commitScript,
            internalKey: new Uint8Array(32) // Required field with proper size
          },
          inscription: inscriptionData.inscription,
          revealPublicKey: revealPublicKey
        } as any,
        utxos: utxosForApi,
        changeAddress: walletAddress,
        feeRate: selectedFeeRate,
        network: inscriptionData.network,
        minimumCommitAmount: Number(inscriptionData.requiredCommitAmount)
      });
      
      // Store the PSBT for signing
      setUnsignedPsbt(commitResult.commitPsbtBase64);
      
      // Update transaction status to include fee breakdown
      setTransactionInfo({
        status: 'preparing',
        feeDetails: {
          commitFeeRate: selectedFeeRate,
          commitFee: commitResult.fees.commit,
          commitVSize: Math.ceil(commitResult.fees.commit / selectedFeeRate),
          revealFeeRate: selectedFeeRate,
          revealFee: revealFee,
          revealVSize: revealTxVSize,
          totalFees: commitResult.fees.commit + revealFee
        }
      });
      
      setStatusMessage('Fee breakdown ready. Please review before signing.');
      // The user will proceed to sign using the Sign Transaction button in the fee breakdown UI
      
    } catch (error: any) {
      console.error('Error preparing commit transaction:', error);
      setErrorMessage(error.message || 'An error occurred while preparing the commit transaction');
      // Update transaction status
      setTransactionInfo({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create resource inscription using ordinalsplus package
  const createResourceInscription = async () => {
    if (!walletConnected || !walletAddress) {
      setErrorMessage('Wallet not connected');
      return;
    }
    
    // Validate UTXO selection
    if (!state.utxoSelection || state.utxoSelection.length === 0) {
      setErrorMessage('No UTXOs selected. Please select at least one UTXO.');
      return;
    }
    
    setIsLoading(true);
    setStatusMessage('Preparing resource inscription...');
    setErrorMessage(null);
    
    try {
      // Generate ephemeral key pair for the inscription
      const revealPrivateKeyBytes = secpUtils.randomPrivateKey();
      const revealPublicKeyBytes = btc.utils.pubSchnorr(revealPrivateKeyBytes);
      
      // Prepare content and metadata
      const content = state.contentData.content || '';
      const contentType = state.contentData.type || 'text/plain';
      
      // Process content based on type
      let processedContent: string | Buffer;
      let actualContentSizeBytes: number;
      
      if (typeof content === 'string') {
        if (content.startsWith('data:')) {
          // Handle data URLs (e.g., base64 encoded images)
          const matches = content.match(/^data:([^;]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            // CRITICAL FIX: Extract only the base64 data, not the full data URL
            // The ordinalsplus library expects just the base64 string for images
            const base64Data = matches[2];
            
            // For images, pass the base64 data as a Buffer to ensure proper binary encoding
            if (contentType.startsWith('image/')) {
              processedContent = Buffer.from(base64Data, 'base64');
              actualContentSizeBytes = processedContent.length; // Use the actual binary size
            } else {
              // For other data URLs, pass the full data URL
              processedContent = content;
              actualContentSizeBytes = Buffer.from(content).length;
            }
          } else {
            throw new Error('Invalid data URL format');
          }
        } else {
          // Handle plain text content
          processedContent = content;
          actualContentSizeBytes = Buffer.from(content).length;
        }
      } else {
        // Handle any other content type as string
        processedContent = String(content);
        actualContentSizeBytes = Buffer.from(String(content)).length;
      }
      
      // Process metadata
      let metadataObj: Record<string, any> = {};
      
      // Add standard metadata fields
      if (state.metadata.standard) {
        metadataObj = { ...state.metadata.standard };
      }
      
      // Add verifiable credential if available
      if (state.metadata.verifiableCredential && state.metadata.verifiableCredential.credential) {
        metadataObj.verifiableCredential = state.metadata.verifiableCredential.credential;
      }
      
      // Convert walletNetwork to the expected BitcoinNetwork type for ordinalsplus
      const getOrdinalsPlusNetwork = (network: string | null | undefined): 'mainnet' | 'testnet' | 'signet' => {
        if (!network) return 'mainnet';
        if (network === 'testnet') return 'testnet';
        if (network === 'signet') return 'signet';
        return 'mainnet';
      };
      
      const BTC_NETWORK = getOrdinalsPlusNetwork(walletNetwork);
      
      // Create the inscription using ordinalsplus
      const preparedInscription = ordinalsplus.createInscription({
        content: processedContent,
        contentType: contentType,
        metadata: metadataObj,
        revealPublicKey: revealPublicKeyBytes,
        network: BTC_NETWORK
      });
      
      // Use a more balanced fee calculation approach that won't cause UTXO selection issues
      
      // 1. Start with the selected fee rate
      const baseFeeRate = selectedFeeRate; // Use selected fee rate instead of hardcoded value
      
      // 2. Calculate content size for fee estimation
      const contentSizeBytes = actualContentSizeBytes;
      
      // 3. Use the EXACT same calculation as the ordinalsplus library (corrected version)
      // This matches the fixed logic in packages/ordinalsplus/src/transactions/reveal-transaction.ts
      let estimatedVsize: number;
      if (contentSizeBytes > 0) {
        // Base transaction size (non-witness data)
        const baseSize = 150;
        
        // Witness data includes:
        // - Signature: ~64 bytes
        // - Inscription script: inscription content + ~200 bytes overhead
        // - Control block: ~33 bytes
        const witnessSize = contentSizeBytes + 300;
        
        // vsize = (base_size * 3 + total_size) / 4
        // where total_size = base_size + witness_size
        const totalSize = baseSize + witnessSize;
        estimatedVsize = Math.ceil((baseSize * 3 + totalSize) / 4);
      } else {
        // For non-inscription transactions, use a simpler calculation
        estimatedVsize = 200;
      }
      
      // Calculate fee using ordinalsplus calculateFee function
      const baseRevealFee = Number(ordinalsplus.calculateFee(estimatedVsize, baseFeeRate));
      
      // CRITICAL FIX: Calculate the commit transaction fee to ensure proper funding
      // Estimate commit transaction size (1 input, 2 outputs typically)
      const estimatedCommitTxSize = 150; // Conservative estimate for commit transaction vsize
      const estimatedCommitFee = Number(ordinalsplus.calculateFee(estimatedCommitTxSize, baseFeeRate));
      
      // Define postage value and calculate required commit amount
      const POSTAGE_VALUE = 1000n;
      const requiredCommitAmount = BigInt(baseRevealFee) + POSTAGE_VALUE;
      
      // Update the required amount for UTXO selection (add buffer for commit tx fee)
      const buffer = 1000; // Reasonable buffer
      const totalRequiredForUtxoSelection = Number(requiredCommitAmount) + estimatedCommitFee + buffer;
      setRequiredAmount(totalRequiredForUtxoSelection);
      
      // If UTXOs are already selected, check if they still meet the new requirement
      if (state.utxoSelection && state.utxoSelection.length > 0) {
        const selectedTotal = state.utxoSelection.reduce((sum, utxo) => sum + utxo.value, 0);
        if (selectedTotal < totalRequiredForUtxoSelection) {
          // Clear selection if it no longer meets requirements
          setUtxoSelection([]);
        }
      }
      
      console.log(`[Fee Debug] Content size: ${contentSizeBytes} bytes`);
      console.log(`[Fee Debug] Estimated vsize: ${estimatedVsize} vB`);
      console.log(`[Fee Debug] Fee rate: ${baseFeeRate} sat/vB`);
      console.log(`[Fee Debug] Reveal fee: ${baseRevealFee} sats`);
      console.log(`[Fee Debug] Commit fee estimate: ${estimatedCommitFee} sats`);
      console.log(`[Fee Debug] Postage value: ${POSTAGE_VALUE} sats`);
      console.log(`[Fee Debug] Buffer: ${buffer} sats`);
      console.log(`[Fee Debug] Commit output amount: ${requiredCommitAmount} sats`);
      console.log(`[Fee Debug] Total required for UTXO selection: ${totalRequiredForUtxoSelection} sats`);
      
      // Add detailed breakdown for large content
      if (contentSizeBytes > 50000) { // 50KB threshold
        console.warn(`[Large Content Warning] Content size is ${(contentSizeBytes / 1024).toFixed(1)}KB`);
        console.warn(`[Large Content Warning] This will result in high fees: ${baseRevealFee} sats (~$${(baseRevealFee * 0.00000001 * 60000).toFixed(2)} USD)`);
        console.warn(`[Large Content Warning] Consider compressing the image or using a lower fee rate`);
        
        // Calculate fees at different rates for comparison
        const lowFeeRate = 5;
        const lowRevealFee = Number(ordinalsplus.calculateFee(estimatedVsize, lowFeeRate));
        const lowCommitFee = Number(ordinalsplus.calculateFee(estimatedCommitTxSize, lowFeeRate));
        const lowTotalRequired = lowRevealFee + 1000 + lowCommitFee + buffer;
        
        console.log(`[Fee Comparison] At ${lowFeeRate} sat/vB: ${lowTotalRequired} sats (~$${(lowTotalRequired * 0.00000001 * 60000).toFixed(2)} USD)`);
        
        // Set a warning message for the user
        setStatusMessage(`⚠️ Large content detected (${(contentSizeBytes / 1024).toFixed(1)}KB). This will require ${totalRequiredForUtxoSelection} sats (~$${(totalRequiredForUtxoSelection * 0.00000001 * 60000).toFixed(2)} USD) in fees. Consider using ${lowFeeRate} sat/vB fee rate (${lowTotalRequired} sats) or compressing your image.`);
      }
      
      // We don't need to create the commit transaction here anymore
      // Just prepare the inscription data and store it for later use
      
      // Store this data in localStorage for later use in the commit and reveal steps
      localStorage.setItem('inscriptionData', JSON.stringify({
        commitAddress: preparedInscription.commitAddress.address,
        commitScriptHex: Buffer.from(preparedInscription.commitAddress.script).toString('hex'),
        inscriptionScriptHex: Buffer.from(preparedInscription.inscriptionScript.script).toString('hex'),
        inscriptionScript: preparedInscription.inscriptionScript,
        inscription: preparedInscription.inscription,
        controlBlockHex: Buffer.from(preparedInscription.inscriptionScript.controlBlock).toString('hex'),
        leafVersion: preparedInscription.inscriptionScript.leafVersion,
        revealPublicKeyHex: Buffer.from(revealPublicKeyBytes).toString('hex'),
        revealPrivateKeyHex: Buffer.from(revealPrivateKeyBytes).toString('hex'),
        requiredCommitAmount: requiredCommitAmount.toString(),
        feeRate: baseFeeRate,
        network: BTC_NETWORK
      }));
      
      // Set status message
      setStatusMessage('Inscription data prepared. Please select UTXOs to fund the transaction.');
    } catch (error: any) {
      console.error('Error creating resource inscription:', error);
      setErrorMessage(error.message || 'An error occurred while creating the resource inscription');
      // Update transaction status
      setTransactionInfo({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Sign PSBT
  const signTransaction = async () => {
    if (!unsignedPsbt) {
      setErrorMessage('No unsigned PSBT available. Please try preparing the transaction again.');
      return;
    }
    
    // Check if wallet is connected and signPsbt function is available
    if (!walletConnected || typeof signPsbt !== 'function') {
      setErrorMessage('Wallet connection issue. Please reconnect your wallet.');
      return;
    }
    
    setIsLoading(true);
    setStatusMessage('Signing transaction...');
    setErrorMessage(null);
    
    try {
      // Call the wallet's signPsbt function
      const signedPsbtHex = await signPsbt(unsignedPsbt);
      
      // Store the signed PSBT
      setSignedPsbt(signedPsbtHex);
      
      // Update transaction status
      setTransactionInfo({
        status: 'signing'
      });
      
      setStatusMessage('Transaction signed. Broadcasting automatically...');
      
      // Automatically broadcast the transaction after signing
      if (signedPsbtHex) {
        // Wait a moment before proceeding to broadcast
        setTimeout(async () => {
          try {
            await broadcastTransaction(signedPsbtHex); // Pass the signed PSBT directly
          } catch (error) {
            console.error('Error in automatic broadcast:', error);
            setErrorMessage(`Failed to broadcast after signing: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error signing transaction:', error);
      const errorMsg = `Failed to sign transaction: ${error instanceof Error ? error.message : 'User rejected signing'}`;
      setErrorMessage(errorMsg);
      
      // Set validation error
      setError('transaction', errorMsg);
      
      // Update transaction status
      setTransactionInfo({
        status: 'failed',
        error: error instanceof Error ? error.message : 'User rejected signing'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Broadcast commit transaction and handle reveal transaction creation
  const broadcastTransaction = async (signedPsbtHex?: string) => {
    // Use the passed parameter or fall back to state
    const psbtToUse = signedPsbtHex || signedPsbt;
    
    if (!psbtToUse) {
      setErrorMessage('No signed PSBT available');
      return;
    }
    
    setIsLoading(true);
    setStatusMessage('Broadcasting commit transaction...');
    setErrorMessage(null);
    
    try {
      // Update transaction status
      setTransactionInfo({
        status: 'broadcasting'
      });
      
      // Use the combined finalizeAndExtractTransaction function from the library
      let extractedTxHex;
      try {
        extractedTxHex = ordinalsplus.finalizeAndExtractTransaction(psbtToUse);
      } catch (finalizationError) {
        console.error('[BroadcastCommit] Error finalizing PSBT:', finalizationError);
        throw new Error(`Failed to finalize PSBT: ${finalizationError instanceof Error ? finalizationError.message : 'Unknown error'}`);
      }
      
      // Determine network type from wallet network - properly handle signet
      let networkType: string;
      if (walletNetwork === 'mainnet') {
        networkType = 'mainnet';
      } else if (walletNetwork === 'signet') {
        networkType = 'signet';
      } else {
        networkType = 'testnet'; // fallback for testnet or unknown
      }
      
      // Check API service
      if (!apiService) {
        throw new Error('API service not available');
      }
      
      // Setup timeout mechanism to catch hanging requests
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Broadcasting timed out after 30 seconds')), 30000);
      });
      
      // Broadcast with timeout
      const response = await Promise.race([
        apiService.broadcastTransaction(networkType, extractedTxHex),
        timeoutPromise
      ]);
      
      // Extract txid from response - handle different response types safely
      let txid: string;
      if (typeof response === 'string') {
        txid = response;
      } else if (typeof response === 'object' && response !== null) {
        const responseObj = response as Record<string, unknown>;
        txid = typeof responseObj.txid === 'string' ? responseObj.txid : String(response);
      } else {
        txid = String(response);
      }
      
      if (!txid) {
        throw new Error('No transaction ID returned from API');
      }
      
      // Set the commit txid
      setCommitTxid(txid);
      
      // Update transaction info in state - we don't have reveal txid yet
      setTransactionInfo({
        commitTx: txid,
        status: 'confirming'
      });
      
      setStatusMessage('Commit transaction broadcast successfully. Creating reveal transaction...');
      addToast('Your commit transaction has been broadcast to the network.');
      
      // After broadcasting commit, create and broadcast reveal transaction
      await createAndBroadcastRevealTransaction(txid);
      
    } catch (error) {
      console.error('Error broadcasting transaction:', error);
      const errorMsg = `Failed to broadcast transaction: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setErrorMessage(errorMsg);
      
      // Set validation error
      setError('transaction', errorMsg);
      
      // Update transaction status
      setTransactionInfo({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to broadcast transaction'
      });
      
      // Use a proper error object for the error toast
      const errorObj = new Error(error instanceof Error ? error.message : 'Transaction broadcast failed');
      addErrorToast(errorObj);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create and broadcast reveal transaction using real API calls
  const createAndBroadcastRevealTransaction = async (commitTxid: string) => {
    try {
      setStatusMessage('Creating reveal transaction...');
      
      // Load inscription data from localStorage
      const savedInscriptionData = localStorage.getItem('inscriptionData');
      if (!savedInscriptionData) {
        throw new Error('No inscription data found. Please restart the inscription process.');
      }
      
      const inscriptionData = JSON.parse(savedInscriptionData);
      
      if (!commitTxid || !walletAddress) {
        throw new Error('Missing required data for reveal transaction');
      }
      
      // Load required data from saved inscription data
      const commitAddress = inscriptionData.commitAddress;
      const commitScript = hexToBytes(inscriptionData.commitScriptHex);
      const inscriptionScript = hexToBytes(inscriptionData.inscriptionScriptHex);
      const controlBlock = hexToBytes(inscriptionData.controlBlockHex);
      const leafVersion = inscriptionData.leafVersion || 0xc0;
      const feeRate = selectedFeeRate;
      const requiredCommitAmount = BigInt(inscriptionData.requiredCommitAmount);
      const revealPrivateKey = hexToBytes(inscriptionData.revealPrivateKeyHex);
      
      // Determine network type from wallet network - properly handle signet
      let networkType: string;
      if (walletNetwork === 'mainnet') {
        networkType = 'mainnet';
      } else if (walletNetwork === 'signet') {
        networkType = 'signet';
      } else {
        networkType = 'testnet'; // fallback for testnet or unknown
      }
      
      // Create the reveal transaction using ordinalsplus
      const revealTx = await ordinalsplus.createRevealTransaction({
        selectedUTXO: {
          txid: commitTxid,
          vout: 0, // The commit output is typically at index 0
          value: Number(requiredCommitAmount),
          script: { 
            type: 'p2tr',
            address: commitAddress 
          }
        },
        preparedInscription: {
          inscription: inscriptionData.inscription,
          commitAddress: {
            address: commitAddress,
            script: commitScript,
            internalKey: new Uint8Array(32) // Required field with proper size
          },
          revealPublicKey: hexToBytes(inscriptionData.revealPublicKeyHex),
          inscriptionScript: {
            script: inscriptionScript,
            controlBlock: controlBlock,
            leafVersion: leafVersion
          },
          revealPrivateKey: revealPrivateKey
        },
        privateKey: revealPrivateKey,
        feeRate: feeRate,
        network: getScureNetwork(networkType === 'mainnet' ? 'mainnet' : 'testnet'),
        commitTransactionId: commitTxid,
        destinationAddress: walletAddress
      });
      
      // Extract transaction ID and hex
      const revealTxid = revealTx.tx.id;
      const actualRevealVSize = revealTx.vsize; // Get actual vsize from the library
      const actualRevealFee = revealTx.fee; // Get actual fee from the library
      
      // Update fee details with actual reveal transaction data
      const currentFeeDetails = state.transactionInfo.feeDetails;
      if (currentFeeDetails) {
        setTransactionInfo({
          commitTx: commitTxid,
          revealTx: null, // Will be set after successful broadcast
          status: 'broadcasting',
          feeDetails: {
            ...currentFeeDetails,
            revealFee: actualRevealFee,
            revealVSize: actualRevealVSize,
            revealFeeRate: Math.round((actualRevealFee / actualRevealVSize) * 100) / 100, // Calculate actual fee rate
            totalFees: currentFeeDetails.commitFee + actualRevealFee
          }
        });
      }
      
      // Broadcast the reveal transaction
      setStatusMessage('Broadcasting reveal transaction...');
      
      if (!apiService) {
        throw new Error('API service not available');
      }
      
      // Setup timeout mechanism to catch hanging requests
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Broadcasting reveal transaction timed out after 30 seconds')), 30000);
      });
      
      // Broadcast reveal transaction with timeout
      const revealResponse = await Promise.race([
        apiService.broadcastTransaction(networkType, revealTx.hex),
        timeoutPromise
      ]) as unknown;
      
      // Handle response - safely extract txid
      let finalRevealTxid: string;
      if (typeof revealResponse === 'string') {
        finalRevealTxid = revealResponse;
      } else if (typeof revealResponse === 'object' && revealResponse !== null) {
        const responseObj = revealResponse as Record<string, unknown>;
        finalRevealTxid = typeof responseObj.txid === 'string' ? responseObj.txid : String(revealResponse);
      } else {
        finalRevealTxid = String(revealResponse);
      }
      
      // Update state with reveal txid
      setRevealTxid(finalRevealTxid);
      
      // Update transaction info
      setTransactionInfo({
        commitTx: commitTxid,
        revealTx: finalRevealTxid,
        status: 'confirming'
      });
      
      setStatusMessage('Inscription created successfully! Waiting for confirmation.');
      addToast('Your inscription has been successfully created and broadcast to the network.');
      
      // Clear inscription data from localStorage
      localStorage.removeItem('inscriptionData');
      
      return finalRevealTxid;
    } catch (error) {
      console.error('Error creating/broadcasting reveal transaction:', error);
      const errorMsg = `Failed to create/broadcast reveal transaction: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setErrorMessage(errorMsg);
      
      // Don't update transaction status to failed since commit tx was successful
      addErrorToast(new Error(errorMsg));
      
      // We still have the commit transaction, so we're not completely failed
      setStatusMessage('Commit transaction broadcast successfully, but reveal transaction failed.');
      
      throw error;
    }
  };
  
  // Check transaction confirmation
  const checkTransactionConfirmation = async () => {
    if (!commitTxid || !revealTxid) {
      return;
    }
    
    try {
      // Determine network type from wallet network - properly handle signet
      let networkType: string;
      if (walletNetwork === 'mainnet') {
        networkType = 'mainnet';
      } else if (walletNetwork === 'signet') {
        networkType = 'signet';
      } else {
        networkType = 'testnet'; // fallback for testnet or unknown
      }
      
      if (!apiService) {
        throw new Error('API service not available');
      }
      const status = await apiService.getTransactionStatus(networkType, commitTxid);
      
      // Use type assertion to handle the API response
      const statusAny = status as any;
      if (statusAny && (statusAny.confirmed || statusAny.status === 'confirmed')) {
        // Clear any transaction errors
        clearError('transaction');
        
        // Update transaction status
        setTransactionInfo({
          status: 'completed'
        });
        
        setStatusMessage('Transaction confirmed. Resource inscription complete!');
        nextStep(); // Move to the complete step
      }
    } catch (error) {
      // Silently handle transaction confirmation check errors
      // This is not critical functionality
    }
  };
  
  // Utility functions
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast('Copied to clipboard!');
  };
  
  // Convert hex string to Uint8Array
  const hexToBytes = (hex: string): Uint8Array => {
    if (!hex) return new Uint8Array(0);
    return new Uint8Array(hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
  };
  
  // Convert Uint8Array to hex string
  const bytesToHex = (bytes: Uint8Array): string => {
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  };
  
  // Parse metadata from string to JSON object
  const parseMetadata = useCallback((metadataStr: string): Record<string, any> => {
    try {
      if (!metadataStr || metadataStr.trim() === '') return {};
      return JSON.parse(metadataStr);
    } catch (error) {
      console.error('Error parsing metadata:', error);
      setErrorMessage('Invalid metadata format. Please provide valid JSON.');
      return {};
    }
  }, []);
  
  // Copy to clipboard
  const copyToClipboardWithLabel = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        addToast(`${label} copied to clipboard`);
      },
      (err) => {
        console.error('Could not copy text: ', err instanceof Error ? err.message : err);
      }
    );
  };
  
  // Fee rate selector component
  const FeeRateSelector = () => {
    const feeRatePresets = {
      low: 5,
      medium: 10,
      high: 20
    };
    
    const handleFeeRateChange = (mode: 'low' | 'medium' | 'high' | 'custom', customValue?: number) => {
      setFeeRateMode(mode);
      if (mode === 'custom' && customValue !== undefined) {
        setSelectedFeeRate(customValue);
      } else if (mode !== 'custom') {
        setSelectedFeeRate(feeRatePresets[mode]);
      }
    };
    
    return (
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Fee Rate Selection
        </h4>
        <div className="space-y-3">
          {/* Preset buttons */}
          <div className="flex gap-2">
            {Object.entries(feeRatePresets).map(([mode, rate]) => (
              <button
                key={mode}
                onClick={() => handleFeeRateChange(mode as 'low' | 'medium' | 'high')}
                className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                  feeRateMode === mode
                    ? 'bg-indigo-500 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)} ({rate} sats/vB)
              </button>
            ))}
            <button
              onClick={() => handleFeeRateChange('custom')}
              className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                feeRateMode === 'custom'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              Custom
            </button>
          </div>
          
          {/* Custom fee rate input */}
          {feeRateMode === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="1000"
                value={selectedFeeRate}
                onChange={(e) => setSelectedFeeRate(Number(e.target.value))}
                className="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="10"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">sats/vB</span>
            </div>
          )}
          
          {/* Current selection display */}
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Current fee rate: <span className="font-mono font-medium">{selectedFeeRate} sats/vB</span>
            {selectedFeeRate < 5 && (
              <span className="text-amber-600 dark:text-amber-400 ml-2">⚠️ Low fee may cause delays</span>
            )}
            {selectedFeeRate > 50 && (
              <span className="text-red-600 dark:text-red-400 ml-2">⚠️ High fee rate</span>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // Initialize transaction creation and fetch UTXOs on component mount
  useEffect(() => {
    if (state.transactionInfo.status === 'not_started') {
      createResourceInscription();
    }
    
    // Fetch UTXOs if we're connected and don't have any yet
    if (walletConnected && availableUtxos.length === 0) {
      handleFetchUtxos();
    }
  }, [walletConnected]);
  
  // Check transaction confirmation periodically
  useEffect(() => {
    if (state.transactionInfo.status === 'confirming') {
      const interval = setInterval(() => {
        checkTransactionConfirmation();
      }, 30000); // Check every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [state.transactionInfo.status]);
  
  // Recalculate required amount when fee rate changes
  useEffect(() => {
    if (state.contentData.content && state.transactionInfo.status === 'not_started') {
      // Recalculate the required amount with the new fee rate using the same calculation as ordinalsplus library
      const content = state.contentData.content || '';
      const contentSizeBytes = Buffer.from(content).length;
      
      // Use the EXACT same calculation as the ordinalsplus library (corrected version)
      let estimatedVsize: number;
      if (contentSizeBytes > 0) {
        // Base transaction size (non-witness data)
        const baseSize = 150;
        
        // Witness data includes:
        // - Signature: ~64 bytes
        // - Inscription script: inscription content + ~200 bytes overhead
        // - Control block: ~33 bytes
        const witnessSize = contentSizeBytes + 300;
        
        // vsize = (base_size * 3 + total_size) / 4
        // where total_size = base_size + witness_size
        const totalSize = baseSize + witnessSize;
        estimatedVsize = Math.ceil((baseSize * 3 + totalSize) / 4);
      } else {
        // For non-inscription transactions, use a simpler calculation
        estimatedVsize = 200;
      }
      
      // Calculate fee using ordinalsplus calculateFee function
      const baseRevealFee = Number(ordinalsplus.calculateFee(estimatedVsize, selectedFeeRate));
      
      // Define postage value and calculate required commit amount
      const POSTAGE_VALUE = 1000n;
      const requiredCommitAmount = BigInt(baseRevealFee) + POSTAGE_VALUE;
      
      // Update the required amount for UTXO selection (add buffer for commit tx fee)
      const estimatedCommitTxSize = 150; // Conservative estimate for commit transaction vsize
      const estimatedCommitFee = Number(ordinalsplus.calculateFee(estimatedCommitTxSize, selectedFeeRate));
      const buffer = 1000; // Reasonable buffer
      const totalRequiredForUtxoSelection = Number(requiredCommitAmount) + estimatedCommitFee + buffer;
      setRequiredAmount(totalRequiredForUtxoSelection);
      
      // If UTXOs are already selected, check if they still meet the new requirement
      if (state.utxoSelection && state.utxoSelection.length > 0) {
        const selectedTotal = state.utxoSelection.reduce((sum, utxo) => sum + utxo.value, 0);
        if (selectedTotal < totalRequiredForUtxoSelection) {
          // Clear selection if it no longer meets requirements
          setUtxoSelection([]);
        }
      }
    }
  }, [selectedFeeRate, state.contentData.content, state.transactionInfo.status]);
  
  // Calculate total selected value
  const totalSelectedValue = state.utxoSelection.reduce((sum, utxo) => sum + utxo.value, 0);
  
  // Check if selected UTXOs meet the required amount
  const hasEnoughFunds = totalSelectedValue >= requiredAmount;
  
  // Render transaction status and actions
  const renderTransactionStatus = () => {
    switch (state.transactionInfo.status) {
      case 'not_started':
      case 'preparing':
        // Show fee breakdown if available
        if (state.transactionInfo.feeDetails) {
          const { feeDetails } = state.transactionInfo;
          return (
            <div className="space-y-6">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-md">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 flex items-center">
                  <Info className="h-5 w-5 mr-2 text-indigo-500" />
                  Fee Breakdown
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 mb-4">
                  Review the transaction fees before signing. The total fee is comprised of both a commit transaction fee and a reveal transaction fee.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Commit Transaction</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Fee Rate:</span>
                        <span className="font-mono">{feeDetails.commitFeeRate} sats/vB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Virtual Size:</span>
                        <span className="font-mono">{feeDetails.commitVSize} vB</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-gray-700 dark:text-gray-300">Commit Fee:</span>
                        <span className="font-mono">{feeDetails.commitFee} sats</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Reveal Transaction</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Fee Rate:</span>
                        <span className="font-mono">{feeDetails.revealFeeRate} sats/vB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Virtual Size:</span>
                        <span className="font-mono">{feeDetails.revealVSize} vB</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-gray-700 dark:text-gray-300">Reveal Fee:</span>
                        <span className="font-mono">{feeDetails.revealFee} sats</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-md">
                  <div className="flex justify-between font-medium">
                    <span className="text-gray-800 dark:text-gray-200">Total Fee:</span>
                    <span className="font-mono text-gray-800 dark:text-gray-200">{feeDetails.totalFees} sats (~${(feeDetails.totalFees * 0.00000001 * 60000).toFixed(2)} USD)</span>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between mt-6">
                <Button 
                  variant="outline"
                  onClick={() => {
                    // Reset transaction info to go back to UTXO selection
                    setTransactionInfo({
                      status: 'not_started',
                      commitTx: null,
                      revealTx: null
                    });
                  }}
                  className="px-4 py-2"
                >
                  Back to UTXO Selection
                </Button>
                
                <Button
                  onClick={signTransaction}
                  className="px-4 py-2"
                >
                  Sign Transaction
                </Button>
              </div>
            </div>
          );
        }
        
        // Show UTXO selection if we've calculated the required amount
        if (requiredAmount > 0) {
          return (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                  Select UTXOs for Inscription
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    onClick={() => setShowUtxoGuidance(!showUtxoGuidance)}
                    aria-label={showUtxoGuidance ? "Hide guidance" : "Show guidance"}
                  >
                    <Info className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              {/* Fee Rate Selector */}
              <FeeRateSelector />
              
              {/* Large Content Warning */}
              {requiredAmount > 50000 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-md border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 mr-2" />
                    <div className="flex-1">
                      <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                        High Fee Warning
                      </h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                        Your content appears to be large, resulting in high inscription fees. 
                        Required: <span className="font-mono font-medium">{requiredAmount.toLocaleString()} sats</span> 
                        (~${(requiredAmount * 0.00000001 * 60000).toFixed(2)} USD)
                      </p>
                      <div className="space-y-2 text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-200">Suggestions to reduce fees:</p>
                        <ul className="list-disc list-inside space-y-1 text-amber-700 dark:text-amber-300">
                          <li>Use a lower fee rate (try 5 sat/vB for slower but cheaper confirmation)</li>
                          <li>Compress your image to reduce file size</li>
                          <li>Consider using a different image format (WebP, AVIF)</li>
                          <li>Reduce image dimensions if possible</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {showUtxoGuidance && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md text-sm text-blue-800 dark:text-blue-200 mb-4">
                  <h4 className="font-medium mb-2">About UTXO Selection</h4>
                  <p className="mb-2">Select UTXOs to fund your inscription:</p>
                  <ul className="list-disc list-inside space-y-1 mb-2">
                    <li><span className="font-medium">Required amount:</span> {(requiredAmount / 100000000).toFixed(8)} BTC</li>
                    <li><span className="font-medium">Currently selected:</span> {(totalSelectedValue / 100000000).toFixed(8)} BTC</li>
                    <li><span className="font-medium">Status:</span> {hasEnoughFunds ? 
                      <span className="text-green-600 dark:text-green-400">Sufficient funds</span> : 
                      <span className="text-red-600 dark:text-red-400">Insufficient funds</span>}
                    </li>
                    <li><span className="font-medium">Automatic selection</span> chooses optimal UTXOs by default.</li>
                    <li><span className="font-medium">Manual selection</span> allows you to choose specific UTXOs.</li>
                  </ul>
                  <p className="text-xs italic">You can select multiple UTXOs to meet the required amount</p>
                </div>
              )}
              
              {/* Selection Mode Toggle */}
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Selection Mode: </span>
                  {manualSelectionMode ? (
                    <span className="text-amber-600 dark:text-amber-400">Manual Selection</span>
                  ) : (
                    <span className="text-green-600 dark:text-green-400">Automatic (Optimal UTXOs)</span>
                  )}
                </div>
                <Button
                  onClick={toggleSelectionMode}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  {manualSelectionMode ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Auto Select</span>
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4" />
                      <span>Manual Select</span>
                    </>
                  )}
                </Button>
              </div>
              
              {/* Only show the UTXO selector in manual mode or when no UTXOs are selected */}
              {(manualSelectionMode || state.utxoSelection.length === 0 || !hasEnoughFunds) && (
                <UtxoSelector
                  walletConnected={walletConnected}
                  utxos={availableUtxos}
                  selectedUtxos={state.utxoSelection}
                  isFetchingUtxos={isFetchingUtxos}
                  utxoError={utxoError}
                  flowState="awaitingUtxoSelection"
                  onFetchUtxos={handleFetchUtxos}
                  onUtxoSelectionChange={handleUtxoSelectionChange}
                  requiredAmount={requiredAmount}
                />
              )}
              
              <div className="flex justify-between mt-6">
                <div className="text-sm text-gray-500 dark:text-gray-400 self-center">
                  {hasEnoughFunds ? (
                    <span className="text-green-600 dark:text-green-400">✓ Ready to create inscription</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">Please select more UTXOs to meet the required amount</span>
                  )}
                </div>
                <Button
                  onClick={handlePrepareAndSignCommit}
                  disabled={!hasEnoughFunds}
                  className="px-4 py-2"
                >
                  Create Inscription
                </Button>
              </div>
            </div>
          );
        }
        
        // Default loading state when calculating required amount
        return (
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
            <p className="text-gray-700 dark:text-gray-300">
              {statusMessage || 'Preparing resource inscription...'}
            </p>
          </div>
        );
      
      case 'signing':
        return (
          <div className="flex flex-col items-center justify-center p-8 space-y-6">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-2">
                Transaction Signed Successfully
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                {statusMessage || 'Transaction signed. Broadcasting automatically...'}
              </p>
            </div>
            
            {isLoading && (
              <div className="flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500 mr-2" />
                <span className="text-gray-600 dark:text-gray-400">Broadcasting...</span>
              </div>
            )}
          </div>
        );
        
      case 'broadcasting':
        return (
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
            <p className="text-gray-700 dark:text-gray-300">
              {statusMessage || 'Broadcasting transaction...'}
            </p>
          </div>
        );
      
      case 'confirming':
        return (
          <div className="space-y-6">
            <div className="p-4 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-md">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
                <div>
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                    Transaction Broadcast Successfully
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 mt-1">
                    Your resource inscription transaction has been broadcast to the network.
                    Waiting for confirmation (this may take 10-30 minutes).
                  </p>
                </div>
              </div>
            </div>
            
            {commitTxid && (
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Commit Transaction
                </h4>
                <div className="flex items-center space-x-2">
                  <code className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded flex-1 overflow-x-auto">
                    {commitTxid}
                  </code>
                  <button
                    onClick={() => copyToClipboard(commitTxid)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    title="Copy to clipboard"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <a
                    href={`${blockExplorerUrl}/tx/${commitTxid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300"
                    title="View on block explorer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}
            
            {revealTxid && (
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reveal Transaction
                </h4>
                <div className="flex items-center space-x-2">
                  <code className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded flex-1 overflow-x-auto">
                    {revealTxid}
                  </code>
                  <button
                    onClick={() => copyToClipboard(revealTxid)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    title="Copy to clipboard"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <a
                    href={`${blockExplorerUrl}/tx/${revealTxid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300"
                    title="View on block explorer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}
            
            <Button
              onClick={checkTransactionConfirmation}
              variant="outline"
              className="w-full"
            >
              Check Confirmation Status
            </Button>
          </div>
        );
      
      case 'failed':
        return (
          <div className="space-y-6">
            <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-md">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
                <div>
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                    Transaction Failed
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 mt-1">
                    {state.transactionInfo.error || errorMessage || 'An error occurred during the transaction process.'}
                  </p>
                </div>
              </div>
            </div>
            
            <Button
              onClick={() => {
                // Reset transaction state and start over
                setTransactionInfo({
                  commitTx: null,
                  revealTx: null,
                  status: 'not_started'
                });
                setUnsignedPsbt(null);
                setSignedPsbt(null);
                setCommitTxid(null);
                setRevealTxid(null);
                setErrorMessage(null);
                createResourceInscription();
              }}
              className="w-full"
            >
              Try Again
            </Button>
          </div>
        );
      
      default:
        return null;
    }
  };
  
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
        Create Resource Inscription
      </h2>
      
      {renderTransactionStatus()}
      
      {/* Error Message */}
      {errorMessage && state.transactionInfo.status !== 'failed' && (
        <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-md">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
            <p className="text-red-700 dark:text-red-300">{errorMessage}</p>
          </div>
        </div>
      )}
      
      {/* Navigation Buttons */}
      <div className="flex justify-between mt-6">
        <Button
          onClick={previousStep}
          variant="outline"
          className="px-4 py-2"
          disabled={isLoading}
        >
          Back
        </Button>
      </div>
    </div>
  );
};

export default TransactionStep;
