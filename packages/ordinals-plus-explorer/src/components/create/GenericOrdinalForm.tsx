import React, { useState, useCallback, useEffect } from 'react';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { useFeeRates } from '../../hooks/useFeeRates';
import { calculateFee, formatFee } from '../../utils/fees';
import { truncateMiddle } from '../../utils/string';
import { useWallet, Utxo } from '../../context/WalletContext';
import { useApi } from '../../context/ApiContext';
import { Loader2, AlertCircle, CheckCircle, XCircle, UploadCloud, FileText, Image as ImageIcon, Text } from 'lucide-react';
import { formatResourceContent } from 'ordinalsplus';

// Initialize bitcoinjs-lib ECC
bitcoin.initEccLib(ecc);

// Define supported content types
const supportedContentTypes = [
  { mime: 'text/plain', label: 'Text', isText: true },
  { mime: 'application/json', label: 'JSON', isText: true },
  { mime: 'text/html', label: 'HTML', isText: true },
  { mime: 'image/png', label: 'PNG Image', isText: false },
  { mime: 'image/jpeg', label: 'JPEG Image', isText: false },
  { mime: 'image/svg+xml', label: 'SVG Image', isText: false },
  // Add more types as needed
];

type FeeLevel = 'hour' | 'halfHour' | 'fastest';

const ResourceCreationForm: React.FC = () => {
  const [contentType, setContentType] = useState<string>(supportedContentTypes[0].mime);
  const [contentData, setContentData] = useState<string>(''); // Stores text data or base64 for files
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null); // For image previews (base64)
  const [selectedFeeLevel, setSelectedFeeLevel] = useState<FeeLevel>('halfHour');
  const [manualFeeRate, setManualFeeRate] = useState<string>(''); // For custom fee input
  const [useManualFee, setUseManualFee] = useState<boolean>(false);
  const [parentId, setParentId] = useState<string>(''); // State for Parent Resource ID

  // API and Wallet Hooks
  const { apiService } = useApi();
  const { 
    connected: walletConnected, 
    address: walletAddress, 
    publicKey: walletPublicKey,
    network: walletNetwork,
    signPsbt, 
    getUtxos 
  } = useWallet();

  // Fee Rate Hook
  const { feeRates, loading: loadingFees, error: feeError, refreshFees } = useFeeRates();

  // PSBT & Transaction Flow State
  const [txSize, setTxSize] = useState<number | null>(null); // Size in vB from API - REPURPOSE for estimated fee?
  const [signedPsbt, setSignedPsbt] = useState<string | null>(null); // Old state - Remove or repurpose for signed *reveal* tx
  const [txid, setTxid] = useState<string | null>(null); // Can be commit or reveal txid
  const [flowState, setFlowState] = useState<'idle' | 'fetchingPsbt' | 'constructingPsbts' | 'signing' | 'broadcasting' | 'pollingStatus' | 'confirmed' | 'failed'>('idle'); // Added 'constructingPsbts'
  const [flowError, setFlowError] = useState<string | null>(null);
  const [inscriptionRevealScript, setInscriptionRevealScript] = useState<string | null>(null); // Hex script from API
  const [estimatedRevealFee, setEstimatedRevealFee] = useState<number | null>(null); // Fee from API
  const [unsignedCommitPsbt, setUnsignedCommitPsbt] = useState<string | null>(null); // New state
  const [unsignedRevealPsbt, setUnsignedRevealPsbt] = useState<string | null>(null); // New state
  const [signedCommitPsbt, setSignedCommitPsbt] = useState<string | null>(null); // New state
  const [signedRevealPsbt, setSignedRevealPsbt] = useState<string | null>(null); // New state
  const [commitTxid, setCommitTxid] = useState<string | null>(null); // New state
  const [revealTxid, setRevealTxid] = useState<string | null>(null); // New state

  // Derived State
  const isTextContent = supportedContentTypes.find(ct => ct.mime === contentType)?.isText ?? true;
  
  // Calculate the final fee rate to use (handle NaN)
  const getFeeRate = useCallback((): number | undefined => {
    if (useManualFee) {
      const rate = parseInt(manualFeeRate, 10);
      return isNaN(rate) ? undefined : rate;
    } else {
      return feeRates?.[`${selectedFeeLevel}Fee`];
    }
  }, [useManualFee, manualFeeRate, feeRates, selectedFeeLevel]);

  const feeRate = getFeeRate();
  const estimatedFee = calculateFee(txSize, feeRate); // calculateFee handles null/undefined feeRate

  // --- Handlers ---

  const handleContentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setContentType(e.target.value);
    setContentData('');
    setSelectedFile(null);
    setFilePreview(null);
    setFlowState('idle'); // Reset flow state on type change
    setFlowError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFlowState('idle'); // Reset flow state
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
    setFlowState('idle'); // Reset flow state
    setFlowError(null);
  };

  const handleFeeLevelSelect = (level: FeeLevel) => {
    setSelectedFeeLevel(level);
    setUseManualFee(false);
    setManualFeeRate(''); // Clear manual input when selecting preset
    setFlowState('idle'); // Reset flow state
  };

  const handleManualFeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Allow only digits
    setManualFeeRate(value);
    setUseManualFee(true);
    setFlowState('idle'); // Reset flow state
  };
  
  // --- Main Submission Logic ---
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("[Submit DEBUG] handleSubmit triggered."); // Log start
    setFlowError(null);
    // Reset new state variables
    setInscriptionRevealScript(null);
    setEstimatedRevealFee(null);
    setUnsignedCommitPsbt(null);
    setUnsignedRevealPsbt(null);
    setSignedCommitPsbt(null);
    setSignedRevealPsbt(null);
    setCommitTxid(null);
    setRevealTxid(null);
    // Removed old resets
    setTxid(null);
    setTxSize(null);
    setFlowState('idle');

    console.log("[Submit DEBUG] Checking wallet connection...");
    if (!walletConnected || !walletAddress) {
        console.error("[Submit DEBUG] Wallet not connected.");
        setFlowError('Please connect your wallet first.');
        setFlowState('failed');
        return;
    }
    console.log("[Submit DEBUG] Wallet connected.");

    console.log("[Submit DEBUG] Checking content data...");
    if (!contentData) {
        console.error("[Submit DEBUG] Content data missing.");
        setFlowError('Please provide content to inscribe.');
        setFlowState('failed');
        return;
    }
    console.log("[Submit DEBUG] Content data present.");

    console.log("[Submit DEBUG] Getting fee rate...");
    const currentFeeRate = getFeeRate();
    if (currentFeeRate === undefined || currentFeeRate <= 0) {
        console.error("[Submit DEBUG] Invalid fee rate:", currentFeeRate);
        setFlowError('Please select or enter a valid positive fee rate.');
        setFlowState('failed');
        return;
    }
    console.log("[Submit DEBUG] Fee rate valid:", currentFeeRate);

    console.log("[Submit DEBUG] Checking ApiService...");
    if (!apiService) {
        console.error("[Submit DEBUG] ApiService not available.");
        setFlowError('API service is not available. Please try again later.');
        setFlowState('failed');
        return;
    }
    console.log("[Submit DEBUG] ApiService available.");
    
    // --- New Logic --- 
    console.log("[Submit DEBUG] Constructing content object...");
    let finalContentDataObject: any = {};
    if (contentType === 'application/json') {
        try {
            finalContentDataObject = JSON.parse(contentData);
        } catch (jsonError) {
            console.error("[Submit DEBUG] Invalid JSON content:", jsonError);
            setFlowError('Invalid JSON format in content data.');
            setFlowState('failed');
            return;
        }
    } else if (isTextContent) {
        // Represent plain text - using structure { "text": "..." }
        finalContentDataObject = { text: contentData };
    } else {
        // Handle file data (assuming contentData is base64 for files)
        // Using structured format
        finalContentDataObject = { 
            format: contentType, 
            encoding: 'base64', 
            data: contentData.split(',')[1] // Get raw base64
        };
    }

    if (parentId) {
        // Add basic validation check here too
        if (!/^did:btco:\d+\/\d+$/.test(parentId)) {
             console.error("[Submit DEBUG] Invalid Parent ID format during submit:", parentId);
             setFlowError('Invalid Parent Resource ID format.');
             setFlowState('failed');
             return;
        }
        finalContentDataObject.parent = parentId;
        console.log("[Submit DEBUG] Added parentId to content object.");
    }
    console.log("[Submit DEBUG] Final content object:", finalContentDataObject);

    // Format the content using the library function
    let formattedContentString: string;
    try {
        formattedContentString = formatResourceContent(finalContentDataObject); 
        console.log("[Submit DEBUG] Formatted content string:", formattedContentString);
    } catch (formatError) {
        console.error("[Submit DEBUG] Error formatting content:", formatError);
        setFlowError(formatError instanceof Error ? formatError.message : 'Error formatting content');
        setFlowState('failed');
        return;
    }
    // --- End New Logic ---

    console.log("[Submit DEBUG] Preparing inscription via API..."); 
    setFlowState('fetchingPsbt'); // Change state name later if needed
    
    try {
        console.log("[Submit DEBUG] Constructing request object for prepareInscription...");
        const prepareRequest = {
          contentType: contentType,
          content: formattedContentString, // Use the formatted string
          feeRate: currentFeeRate,
        };
        console.log("[Submit DEBUG] Prepare Request object:", prepareRequest);

        console.log("[Submit DEBUG] Calling apiService.prepareInscription...");
        // Ensure apiService has prepareInscription method returning { inscriptionScript: string, estimatedFee: number }
        const { inscriptionScript: fetchedScript, estimatedFee: fetchedFee } = 
            await apiService.prepareInscription(prepareRequest);
        console.log("[Submit DEBUG] apiService.prepareInscription successful.");
        console.log("[Submit DEBUG] Script:", fetchedScript);
        console.log("[Submit DEBUG] Estimated Fee:", fetchedFee);
        
        // Store the results
        setInscriptionRevealScript(fetchedScript);
        setEstimatedRevealFee(fetchedFee);
        setFlowState('idle'); // Ready for next step
        
        console.log("[Submit DEBUG] State updated, calling handleConstructAndSignPsbts...");
        // Call the next step function
        await handleConstructAndSignPsbts(fetchedScript, fetchedFee);

    } catch (err) { 
        const errorMsg = err instanceof Error ? err.message : 'Failed to prepare inscription';
        console.error('[Submit DEBUG] Error in prepare inscription try block:', errorMsg, err);
        setFlowError(errorMsg);
        setFlowState('failed');
    }
  };

  // --- Signing Logic (Placeholder for new function) ---
  const handleConstructAndSignPsbts = async (revealScriptHex: string, revealFeeEstimate: number) => {
    console.log("[PSBT Flow] Starting construction and signing...");
    console.log("[PSBT Flow] Reveal Script (Hex):", revealScriptHex);
    console.log("[PSBT Flow] Estimated Reveal Fee:", revealFeeEstimate);
    setFlowState('constructingPsbts');
    setFlowError(null);
    // TODO: Implement actual PSBT construction logic using wallet context/library
    // 1. Get UTXOs from wallet
    // 2. Get PubKey from wallet
    // 3. Construct Commit PSBT
    // 4. Construct Reveal PSBT (using revealScriptHex)
    // 5. Set unsigned PSBTs in state
    console.warn("[PSBT Flow] PSBT CONSTRUCTION NOT IMPLEMENTED YET");
    setUnsignedCommitPsbt('dummy-commit-psbt-hex'); // Placeholder
    setUnsignedRevealPsbt('dummy-reveal-psbt-hex'); // Placeholder

    // TODO: Implement signing logic using wallet context/library
    // Needs to handle signing *two* PSBTs potentially
    console.warn("[PSBT Flow] PSBT SIGNING NOT IMPLEMENTED YET");
    console.log("[PSBT Flow] Simulating signing...");
    setFlowState('signing');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
    const dummySignedCommit = 'signed-' + (unsignedCommitPsbt || 'commit'); // Use state value if available
    const dummySignedReveal = 'signed-' + (unsignedRevealPsbt || 'reveal'); // Use state value if available
    setSignedCommitPsbt(dummySignedCommit);
    setSignedRevealPsbt(dummySignedReveal);

    console.log("[PSBT Flow] Signing complete (simulated). Proceeding to broadcast.");
    setFlowState('idle');
    await handleBroadcast(dummySignedCommit, dummySignedReveal);
  }

  // --- Broadcasting & Status Check Logic (Updated signature) ---
  const handleBroadcast = async (commitPsbtHex: string | null, revealPsbtHex: string | null) => {
    console.log("[Broadcast Flow] Starting broadcast...");
    if (!commitPsbtHex || !revealPsbtHex) {
        setFlowError('Missing signed PSBTs for broadcast.');
        setFlowState('failed');
        return;
    }
    // ... rest of broadcast logic (needs implementation) ...
    
    // Simulate for now
     if (!apiService) {
        console.error("[Broadcast Flow] ApiService not available.");
        setFlowError('API service is not available for broadcast.');
        setFlowState('failed');
        return;
    }

    setFlowState('broadcasting');
    setFlowError(null);
    setCommitTxid(null);
    setRevealTxid(null);

    try {
        console.warn("[Broadcast Flow] BROADCASTING NOT IMPLEMENTED in apiService");
        console.log("[Broadcast Flow] Broadcasting Commit TX...");
        const dummyCommitTxid = `commit-txid-${Date.now()}`;
        setCommitTxid(dummyCommitTxid);
        console.log("[Broadcast Flow] Commit TX Broadcast (Simulated):", dummyCommitTxid);
        
        await new Promise(resolve => setTimeout(resolve, 1000)); 

        console.log("[Broadcast Flow] Broadcasting Reveal TX...");
        const dummyRevealTxid = `reveal-txid-${Date.now()}`;
        setRevealTxid(dummyRevealTxid);
        console.log("[Broadcast Flow] Reveal TX Broadcast (Simulated):", dummyRevealTxid);

        setFlowState('pollingStatus');
        console.warn("[Broadcast Flow] POLLING NOT IMPLEMENTED YET");
        await new Promise(resolve => setTimeout(resolve, 3000)); 
        console.log("[Broadcast Flow] Simulating confirmation...");
        setFlowState('confirmed');

    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to broadcast transaction';
        console.error('[Broadcast Error]', errorMsg);
        setFlowError(errorMsg);
        setFlowState('failed');
    }
  };

  // Polling function wrapped in useCallback
  const pollTransactionStatus = useCallback((txIdToPoll: string) => {
    // Initial checks (synchronous)
    if (!apiService) {
        console.error('Cannot poll status: API service not available.');
        setFlowError('API service disconnected during polling.')
        setFlowState('failed');
        return () => {}; // Return dummy cleanup function
    }
    console.log(`Polling status for ${txIdToPoll}...`);
    
    // Set up interval (async logic inside the interval callback)
    const intervalId = setInterval(async () => {
        try {
            // This function needs update to handle reveal tx status/inscription ID
            const status = await apiService.getTransactionStatus(txIdToPoll);
            console.log('Poll status:', status);
            // Check the status property of the response
            if (status.status === 'confirmed') { 
                console.log('Transaction confirmed!', status);
                setFlowState('confirmed');
                // Set revealTxid or other relevant state here
                setRevealTxid(txIdToPoll); // Assuming txIdToPoll is the reveal txid
                // If API returns inscription ID: // setInscriptionId(status.inscriptionId || 'N/A');
                clearInterval(intervalId); // Stop polling on confirmation
            }
        } catch (err) {
            console.error('[Polling Error]', err);
            // Optional: Stop polling after too many errors?
            // clearInterval(intervalId);
        }
        // TODO: Add timeout or max retries for polling?
    }, 5000); // Poll every 5 seconds

    // Return cleanup function (synchronous)
    return () => {
        console.log(`Stopping polling for ${txIdToPoll}`);
        clearInterval(intervalId);
    };
  }, [apiService, walletNetwork]); // Dependencies for useCallback
  
  // Effect to manage polling lifecycle
  useEffect(() => {
      let cleanupPolling = () => {};
      if (flowState === 'pollingStatus' && txid) {
          cleanupPolling = pollTransactionStatus(txid);
      }
      // Return the cleanup function to be called on unmount or when dependencies change
      return cleanupPolling;
  }, [flowState, txid, pollTransactionStatus]);

  // --- Render Logic ---

  const renderContentInput = () => {
    if (isTextContent) {
      return (
        <textarea
          rows={6}
          value={contentData}
          onChange={handleTextChange}
          placeholder={contentType === 'application/json' ? 'Enter valid JSON data' : 'Enter plain text'}
          className="block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm dark:bg-gray-900"
          disabled={flowState !== 'idle'}
        />
      );
    } else {
      // File Input
      return (
        <div className="flex flex-col items-center space-y-4">
          <div className="w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 overflow-hidden">
            {filePreview ? (
              <img src={filePreview} alt="Preview" className="max-h-full max-w-full object-contain rounded" />
            ) : selectedFile ? (
              <div className="text-center p-2">
                  <FileText className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs">({(selectedFile.size / 1024).toFixed(1)} KB)</p>
              </div>
            ) : (
              <div className="text-center p-2">
                <UploadCloud className="w-10 h-10 mx-auto mb-2" />
                <p>Drag & drop or click to upload</p>
                <p className="text-xs">({contentType.split('/')[1].toUpperCase()})</p>
              </div>
            )}
          </div>
          <input 
            type="file"
            accept={contentType} // Restrict file types
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 dark:file:bg-gray-700 dark:file:text-orange-300 dark:hover:file:bg-gray-600 disabled:opacity-50"
            disabled={flowState !== 'idle'}
          />
        </div>
      );
    }
  };

  const renderFeeSelector = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Fee Rate (sat/vB)</label>
        <button type="button" onClick={refreshFees} disabled={loadingFees} className="text-xs text-orange-600 hover:underline disabled:opacity-50">
          {loadingFees ? <Loader2 className="animate-spin h-3 w-3 inline-block"/> : 'Refresh'}
        </button>
      </div>
      {loadingFees && !feeRates && <div className="flex items-center text-sm text-gray-500"><Loader2 className="animate-spin h-4 w-4 mr-2"/>Loading fees...</div>}
      {feeError && <div className="text-sm text-red-500 flex items-center"><AlertCircle className="h-4 w-4 mr-1"/>{feeError}</div>}
      {feeRates && (
        <div className="flex flex-wrap items-center gap-2">
          {(['hour', 'halfHour', 'fastest'] as FeeLevel[]).map((level) => {
            const rateValue = feeRates[`${level}Fee`];
            const label = level.charAt(0).toUpperCase() + level.slice(1).replace('Hour', ' Hour');
            return (
              <button
                key={level}
                type="button"
                onClick={() => handleFeeLevelSelect(level)}
                disabled={flowState !== 'idle'}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border 
                            ${!useManualFee && selectedFeeLevel === level 
                              ? 'bg-orange-600 text-white border-orange-600' 
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'}
                            ${flowState !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {label} ({rateValue} sat/vB)
              </button>
            );
          })}
           {/* Custom Fee Input */}
           <div className="flex items-center space-x-1">
               <input 
                    type="checkbox" 
                    id="manualFeeCheckbox"
                    checked={useManualFee}
                    onChange={(e) => setUseManualFee(e.target.checked)}
                    disabled={flowState !== 'idle'}
                    className="h-4 w-4 rounded border-gray-300 text-orange-600 shadow-sm focus:ring-orange-500 disabled:opacity-50"
               />
               <label htmlFor="manualFeeCheckbox" className="text-xs font-medium text-gray-700 dark:text-gray-300">Custom:</label>
                <input 
                    type="text" 
                    value={manualFeeRate}
                    onChange={handleManualFeeChange}
                    onFocus={() => setUseManualFee(true)}
                    placeholder="e.g. 20" 
                    disabled={flowState !== 'idle'}
                    className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-900 disabled:opacity-50"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">sat/vB</span>
           </div>
        </div>
      )}
      {/* Estimated Fee Display */} 
      {txSize !== null && (
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Estimated Size: <span className="font-medium">{txSize ?? 'Estimating...'} vB</span> | 
              Fee Rate: <span className="font-medium">{feeRate ?? 'N/A'} sat/vB</span> | 
              Estimated Fee: <span className="font-medium">{formatFee(estimatedFee)}</span>
          </div>
      )}
    </div>
  );

  const renderStatusDisplay = () => {
      if (flowState === 'idle' && !flowError) return null;
      
      let icon: React.ReactNode = null;
      let message: string = '';
      let details: React.ReactNode = null;
      let colorClass = 'text-gray-600 dark:text-gray-400';
      
      switch (flowState) {
          case 'fetchingPsbt':
              icon = <Loader2 className="animate-spin h-5 w-5 mr-2" />;
              message = 'Preparing transaction...';
              colorClass = 'text-blue-600 dark:text-blue-400';
              break;
          case 'signing':
              icon = <Loader2 className="animate-spin h-5 w-5 mr-2" />;
              message = 'Waiting for wallet signature...';
              colorClass = 'text-blue-600 dark:text-blue-400';
              break;
          case 'broadcasting':
              icon = <Loader2 className="animate-spin h-5 w-5 mr-2" />;
              message = 'Broadcasting transaction...';
              colorClass = 'text-blue-600 dark:text-blue-400';
              break;
          case 'pollingStatus':
              icon = <Loader2 className="animate-spin h-5 w-5 mr-2" />;
              message = 'Waiting for blockchain confirmation...';
              details = txid ? <a href={`https://mempool.space/tx/${txid}`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-600 hover:underline">(View Tx: {txid.substring(0,8)}...)</a> : null;
              colorClass = 'text-gray-600 dark:text-gray-400';
              break;
          case 'confirmed':
              icon = <CheckCircle className="h-5 w-5 mr-2 text-green-500" />;
              message = 'Inscription Confirmed!';
              details = (
                <div className="p-4 rounded-md bg-green-50 dark:bg-green-900/30">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-400 dark:text-green-500" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800 dark:text-green-300">Inscription Confirmed!</h3>
                      <div className="mt-2 text-sm text-green-700 dark:text-green-400">
                        <p>Commit TX: {commitTxid ? 
                          <a href={`https://mempool.space/tx/${commitTxid}`} target="_blank" rel="noopener noreferrer" className="font-medium underline hover:text-green-600 dark:hover:text-green-300">{truncateMiddle(commitTxid)}</a> 
                          : 'N/A'}</p>
                        <p>Reveal TX (Inscription): {revealTxid ? 
                          <a href={`https://mempool.space/tx/${revealTxid}`} target="_blank" rel="noopener noreferrer" className="font-medium underline hover:text-green-600 dark:hover:text-green-300">{truncateMiddle(revealTxid)}</a> 
                          : 'N/A'}</p>
                        {/* TODO: Add link to ordinals explorer using revealTxid */} 
                      </div>
                    </div>
                  </div>
                </div>
              );
              colorClass = 'text-green-600 dark:text-green-400';
              break;
          case 'failed':
              icon = <XCircle className="h-5 w-5 mr-2 text-red-500" />;
              message = 'Operation Failed';
              details = flowError ? <p className="text-xs mt-1">{flowError}</p> : null;
              colorClass = 'text-red-600 dark:text-red-400';
              break;
      }
      
      return (
          <div className={`mt-6 p-4 rounded-lg border ${colorClass.includes('red') ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700' : colorClass.includes('green') ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700' : 'border-gray-300 bg-gray-50 dark:bg-gray-700 dark:border-gray-600'}`}>
            <div className="flex items-center">
                {icon}
                <span className="font-medium">{message}</span>
            </div>
            {details && <div className="mt-1 pl-7">{details}</div>}
          </div>
      );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      {/* Content Type Selection */} 
      <div>
        <label htmlFor="contentType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Content Type
        </label>
        <select
          id="contentType"
          value={contentType}
          onChange={handleContentTypeChange}
          className="block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm dark:bg-gray-900"
          disabled={flowState !== 'idle'}
        >
          {supportedContentTypes.map(ct => (
            <option key={ct.mime} value={ct.mime}>{ct.label}</option>
          ))}
        </select>
      </div>

      {/* Content Data Input */} 
      <div>
        <label htmlFor="contentData" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Content Data
        </label>
        {renderContentInput()}
      </div>

      {/* Parent Resource ID Input (Optional) */}
      <div className="mb-4">
          <label htmlFor="parentId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Parent Resource ID (Optional)
          </label>
          <input
              type="text"
              id="parentId"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              placeholder="did:btco:<sat_number>/<index>"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          />
          {/* Basic Format Hint/Validation Feedback (Optional) */}
          {parentId && !/^did:btco:\d+\/\d+$/.test(parentId) && (
              <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">Invalid format. Expected: did:btco:sat/index</p>
          )}
      </div>

      {/* Fee Selection */} 
      {renderFeeSelector()}
      
      {/* Submit Button */} 
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
         {!walletConnected && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">Please connect your wallet to proceed.</p>
         )}
        <button 
          type="submit"
          disabled={!walletConnected || !contentData || feeRate === undefined || feeRate <= 0 || flowState !== 'idle'}
          className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {flowState === 'idle' ? 'Prepare Inscription' : 
           flowState === 'fetchingPsbt' ? 'Preparing...' : 
           flowState === 'signing' ? 'Waiting for Signature...' : 
           flowState === 'broadcasting' ? 'Broadcasting...' : 
           flowState === 'pollingStatus' ? 'Confirming...' : 
           flowState === 'confirmed' ? 'Confirmed!' : 
           flowState === 'failed' ? 'Retry?' : // Or just disabled?
           'Processing...' // Fallback
          }
        </button>
      </div>
      
      {/* Status Display Area */}
      {renderStatusDisplay()}

    </form>
  );
};

export default ResourceCreationForm; 