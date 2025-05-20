import React, { useState, useEffect, useCallback } from 'react';
import { useResourceInscription } from './ResourceInscriptionWizard';
import { useWallet, Utxo } from '../../context/WalletContext';
import { useApi } from '../../context/ApiContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui';
import { Loader2, AlertCircle, CheckCircle, Copy, ExternalLink, Info } from 'lucide-react';
import UtxoSelector from '../create/UtxoSelector';
import * as ordinalsplus from 'ordinalsplus';
import * as btc from '@scure/btc-signer';
import { utils as secpUtils } from '@noble/secp256k1';

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
  
  // UTXO selection state
  const [availableUtxos, setAvailableUtxos] = useState<Utxo[]>([]);
  const [isFetchingUtxos, setIsFetchingUtxos] = useState<boolean>(false);
  const [utxoError, setUtxoError] = useState<string | null>(null);
  const [showUtxoGuidance, setShowUtxoGuidance] = useState<boolean>(false);
  const [requiredAmount, setRequiredAmount] = useState<number>(0);
  
  // Inscription-specific state
  const [ephemeralRevealPrivateKeyWif, setEphemeralRevealPrivateKeyWif] = useState<string | null>(null);
  
  // Get block explorer URL based on network
  const blockExplorerUrl = walletNetwork === 'testnet'
    ? 'https://mempool.space/testnet'
    : 'https://mempool.space';
  
  // Interface for the ordinalsplus.OrdinalInscription type
  interface OrdinalInscription {
    tags: Record<string, string>;
    body: string | Uint8Array;
  }
  
  // Interface for P2TR address info
  interface P2TRAddressInfo {
    address: string;
    script: Uint8Array;
    internalKey: Uint8Array;
  }
  
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
  
  // Prepare and sign commit transaction
  const handlePrepareAndSignCommit = async () => {
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
    setStatusMessage('Preparing commit transaction...');
    setErrorMessage(null);
    
    try {
      // Map selected UTXOs to the format expected by ordinalsplus
      const utxosForApi = state.utxoSelection.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        scriptPubKey: utxo.scriptPubKey || ''
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
      
      // Prepare the commit transaction
      console.log('[PrepareAndSignCommit] Creating commit transaction...');
      
      const safetyBufferFeeRate = inscriptionData.feeRate + 0.1;
      const requiredCommitAmount = BigInt(inscriptionData.requiredCommitAmount);
      
      const commitResult = await ordinalsplus.prepareCommitTransaction({
        inscription: {
          commitAddress: {
            address: inscriptionData.commitAddress,
            script: commitScript,
            internalKey: new Uint8Array(32) // Required field with proper size
          },
          inscription: inscriptionData.inscription,
          revealPublicKey: revealPublicKey,
        } as any,
        utxos: utxosForApi,
        changeAddress: walletAddress,
        feeRate: safetyBufferFeeRate,
        network: inscriptionData.network,
        minimumCommitAmount: Number(requiredCommitAmount)
      });
      
      console.log(`[PrepareAndSignCommit] Commit transaction prepared, fee: ${commitResult.fees.commit} sats`);
      
      // Store the PSBT for signing
      setUnsignedPsbt(commitResult.commitPsbtBase64);
      
      // Update transaction status to signing
      setTransactionInfo({
        status: 'signing'
      });
      
      setStatusMessage('Commit transaction prepared. Please sign it with your wallet.');
      
      // Proceed with signing
      await signTransaction();
      
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
      console.log('[ResourceInscription] Generating ephemeral keypair...');
      const revealPrivateKeyBytes = secpUtils.randomPrivateKey();
      const revealPublicKeyBytes = btc.utils.pubSchnorr(revealPrivateKeyBytes);
      setEphemeralRevealPrivateKeyWif(Buffer.from(revealPrivateKeyBytes).toString('hex'));
      console.log(`[ResourceInscription] Ephemeral Public Key generated: ${Buffer.from(revealPublicKeyBytes).toString('hex')}`);
      
      // Prepare content and metadata
      const content = state.contentData.content || '';
      const contentType = state.contentData.type || 'text/plain';
      
      // Process content based on type
      let processedContent: string | Buffer;
      
      if (typeof content === 'string') {
        if (content.startsWith('data:')) {
          // Handle data URLs (e.g., base64 encoded images)
          const matches = content.match(/^data:([^;]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            processedContent = content;
          } else {
            throw new Error('Invalid data URL format');
          }
        } else {
          // Handle plain text content
          processedContent = content;
        }
      } else {
        // Handle any other content type as string
        processedContent = String(content);
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
      
      const BTC_NETWORK = walletNetwork ? getOrdinalsPlusNetwork(walletNetwork) : 'mainnet';
      
      // Create the inscription using ordinalsplus
      console.log('[ResourceInscription] Preparing inscription data...');
      const preparedInscription = ordinalsplus.createInscription({
        content: processedContent,
        contentType: contentType,
        metadata: metadataObj,
        revealPublicKey: revealPublicKeyBytes,
        network: BTC_NETWORK
      });
      
      console.log('[ResourceInscription] Inscription data prepared');
      
      // Calculate fees
      const feeRate = 5; // Default fee rate, could be made configurable
      const safetyBufferFeeRate = feeRate + 0.1;
      
      // Calculate content size for fee estimation
      const contentSizeBytes = Buffer.from(processedContent).length;
      
      const baseRevealTxSize = 200; // Base size of the reveal transaction
      const estimatedTotalVBytes = baseRevealTxSize + (contentSizeBytes * 1.02);
      
      const revealFee = ordinalsplus.calculateFee(Math.ceil(estimatedTotalVBytes), safetyBufferFeeRate);
      console.log(`[ResourceInscription] Estimated reveal fee: ${revealFee} sats`);
      
      // Define postage value (minimum amount to be sent to the inscription output)
      const POSTAGE_VALUE = 1000n; // 1000 sats
      const requiredCommitAmount = BigInt(revealFee) + POSTAGE_VALUE;
      
      // Update the required amount for UTXO selection
      setRequiredAmount(Number(requiredCommitAmount) + 10000); // Add extra buffer for commit tx fee
      
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
        feeRate: safetyBufferFeeRate,
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
      setErrorMessage('No unsigned PSBT available');
      return;
    }
    
    setIsLoading(true);
    setStatusMessage('Signing transaction...');
    setErrorMessage(null);
    
    try {
      // Sign the PSBT
      const signedPsbtHex = await signPsbt(unsignedPsbt);
      setSignedPsbt(signedPsbtHex);
      setStatusMessage('Transaction signed. Ready to broadcast.');
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
  const broadcastTransaction = async () => {
    if (!signedPsbt) {
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
      
      // Finalize the PSBT and extract the raw transaction
      console.log('[BroadcastCommit] Finalizing PSBT...');
      const finalizedTx = ordinalsplus.finalizePsbt(signedPsbt);
      console.log('[BroadcastCommit] PSBT finalized successfully');
      
      console.log('[BroadcastCommit] Extracting transaction...');
      const extractedTxHex = ordinalsplus.extractTransaction(finalizedTx);
      console.log('[BroadcastCommit] Transaction extracted successfully');
      
      // Broadcast the extracted transaction
      const networkType = walletNetwork || 'mainnet';
      if (!apiService) {
        throw new Error('API service not available');
      }
      
      console.log('[BroadcastCommit] Broadcasting transaction...');
      const response = await apiService.broadcastTransaction(networkType, extractedTxHex);
      
      // Extract txid from response
      const txid = typeof response === 'object' && response !== null ? response.txid : response;
      console.log(`[BroadcastCommit] Commit transaction broadcast with txid: ${txid}`);
      
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
  
  // Create and broadcast reveal transaction
  const createAndBroadcastRevealTransaction = async (commitTxid: string) => {
    try {
      console.log('[CreateReveal] Starting reveal transaction creation...');
      setStatusMessage('Creating reveal transaction...');
      
      // Retrieve inscription data from localStorage
      const inscriptionDataStr = localStorage.getItem('inscriptionData');
      if (!inscriptionDataStr) {
        throw new Error('Inscription data not found. Cannot create reveal transaction.');
      }
      
      const inscriptionData = JSON.parse(inscriptionDataStr);
      console.log('[CreateReveal] inscriptionData: ', inscriptionData);
      // Convert hex strings back to Uint8Arrays
      const commitScript = new Uint8Array(Buffer.from(inscriptionData.commitScriptHex, 'hex'));
      const controlBlock = new Uint8Array(Buffer.from(inscriptionData.controlBlockHex, 'hex'));
      const inscriptionScript = new Uint8Array(Buffer.from(inscriptionData.inscriptionScriptHex, 'hex'));
      const revealPublicKey = new Uint8Array(Buffer.from(inscriptionData.revealPublicKeyHex, 'hex'));
      const revealPrivateKey = new Uint8Array(Buffer.from(inscriptionData.revealPrivateKeyHex, 'hex'));
      const requiredCommitAmount = BigInt(inscriptionData.requiredCommitAmount);
      
      // Get the network from ordinalsplus
      const scureNetwork = ordinalsplus.getScureNetwork(inscriptionData.network);
      
      // Create the reveal transaction
      console.log('[CreateReveal] Creating reveal transaction with ephemeral key');
      const revealTx = await ordinalsplus.createRevealTransaction({
        selectedUTXO: {
          txid: commitTxid,
          vout: 0, // Assume the first output is the commit output
          value: Number(requiredCommitAmount),
          script: { 
            type: 'p2tr',
            address: inscriptionData.commitAddress 
          }
        },
        preparedInscription: {
          inscription: inscriptionData.inscription,
          commitAddress: {
            address: inscriptionData.commitAddress,
            script: commitScript,
            internalKey: new Uint8Array(32) // Required field with proper size
          },
          revealPublicKey: revealPublicKey,
          inscriptionScript: {
            script: inscriptionScript,
            controlBlock: controlBlock,
            leafVersion: inscriptionData.inscriptionScript.leafVersion
          },
          revealPrivateKey: revealPrivateKey
        },
        privateKey: revealPrivateKey,
        feeRate: inscriptionData.feeRate,
        network: scureNetwork,
        commitTransactionId: commitTxid,
        destinationAddress: walletAddress || ''
      });
      // Extract transaction ID
      const revealTxid = revealTx.tx.id;
      console.log(`[CreateReveal] Reveal TX constructed. Txid: ${revealTxid}`);
      
      // Broadcast the reveal transaction
      console.log('[BroadcastReveal] Broadcasting reveal transaction...');
      setStatusMessage('Broadcasting reveal transaction...');
      
      if (!apiService) {
        throw new Error('API service not available');
      }
      const revealResponse = await apiService.broadcastTransaction(inscriptionData.network, revealTx.hex);
      const finalRevealTxid = typeof revealResponse === 'object' && revealResponse !== null ? 
        revealResponse.txid : revealResponse;
      
      console.log(`[BroadcastReveal] Reveal transaction broadcast with txid: ${finalRevealTxid}`);
      
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
      // Check transaction status
      const networkType = walletNetwork || 'mainnet';
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
      console.error('Error checking transaction confirmation:', error instanceof Error ? error.message : error);
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
  
  // Generate a random key pair for the inscription
  // This is a simplified version that doesn't rely on external libraries
  const generateEphemeralKeyPair = useCallback(async () => {
    try {
      // In a real implementation, we would use the wallet's key management
      // For now, we'll just simulate it with a random string
      const simulatedWif = 'simulated_wif_' + Date.now();
      
      setEphemeralRevealPrivateKeyWif(simulatedWif);
      return { 
        wif: simulatedWif,
        // These would be actual keys in a real implementation
        privateKey: new Uint8Array(32), 
        publicKey: new Uint8Array(33) 
      };
    } catch (error) {
      console.error('Error generating ephemeral key pair:', error);
      setErrorMessage('Failed to generate ephemeral key pair for inscription.');
      throw error;
    }
  }, [walletNetwork]);
  
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
  
  // Calculate total selected value
  const totalSelectedValue = state.utxoSelection.reduce((sum, utxo) => sum + utxo.value, 0);
  
  // Check if selected UTXOs meet the required amount
  const hasEnoughFunds = totalSelectedValue >= requiredAmount;
  
  // Render transaction status and actions
  const renderTransactionStatus = () => {
    switch (state.transactionInfo.status) {
      case 'not_started':
      case 'preparing':
        // Show UTXO selection if we've calculated the required amount
        if (requiredAmount > 0) {
          return (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                  Select UTXOs for Inscription
                </h3>
                <button
                  type="button"
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => setShowUtxoGuidance(!showUtxoGuidance)}
                  aria-label={showUtxoGuidance ? "Hide guidance" : "Show guidance"}
                >
                  <Info className="h-5 w-5" />
                </button>
              </div>
              
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
                  </ul>
                  <p className="text-xs italic">You can select multiple UTXOs to meet the required amount</p>
                </div>
              )}
              
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
          <div className="space-y-6">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                Sign Transaction
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Please sign the transaction with your wallet to create the resource inscription.
              </p>
              <Button
                onClick={signTransaction}
                disabled={isLoading || !unsignedPsbt}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Signing...
                  </>
                ) : (
                  'Sign Transaction'
                )}
              </Button>
            </div>
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
        
        {state.transactionInfo.status === 'signing' && signedPsbt && (
          <Button
            onClick={broadcastTransaction}
            className="px-4 py-2"
            disabled={isLoading}
          >
            Broadcast Transaction
          </Button>
        )}
      </div>
    </div>
  );
};

export default TransactionStep;
