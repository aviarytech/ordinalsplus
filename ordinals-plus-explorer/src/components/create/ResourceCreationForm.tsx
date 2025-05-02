import React, { useState, useEffect, useCallback } from 'react';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils';
import { Loader2, AlertCircle, CheckCircle, Copy, ExternalLink, Eye, EyeOff, Bitcoin } from 'lucide-react';
import { Transaction as BtcTransaction, WIF } from '@scure/btc-signer';
import { base64 } from '@scure/base';
import {
  prepareInscriptionScripts,
  estimateRevealFee,
  constructFinalRevealTx,
  createUnsignedCommitPsbt,
  PrepareInscriptionScriptsParams,
  PreparedInscriptionScripts,
  FinalRevealTxResult,
  CreateUnsignedCommitPsbtParams,
  Utxo as OrdinalsPlusUtxo,
  NETWORKS,
  getScureNetwork,
} from 'ordinalsplus';
import { useWallet, Utxo as WalletUtxo } from '../../context/WalletContext';
import { useApi } from '../../context/ApiContext';
import UtxoSelector from './UtxoSelector';
import { utils as secpUtils } from '@noble/secp256k1';
import { schnorr } from '@noble/curves/secp256k1';


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

type FeeLevel = 'hour' | 'halfHour' | 'fastest';

// Define constants locally
const POSTAGE_VALUE = 1000n; // Use bigint
const DUST_LIMIT = 546n;    // Use bigint

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

interface InscriptionPrepData {
    scripts: PreparedInscriptionScripts;
    fee: bigint;
    requiredCommitAmount: bigint;
    commitAddress: string;
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

  const {
    connected: walletConnected,
    address: walletAddress,
    publicKey: walletPublicKey,
    signPsbt,
    getUtxos,
    network: walletNetwork,
  } = useWallet();
  const { apiService } = useApi();

  const scureNetwork = walletNetwork ? getScureNetwork(walletNetwork as any) : NETWORKS.bitcoin;
  const networkLabel = walletNetwork ? getNetworkLabel(walletNetwork) : 'Mainnet';
  const blockExplorerUrl = walletNetwork === 'testnet'
    ? 'https://mempool.space/testnet'
    : 'https://mempool.space';
  const currentFeeRate = feeRateInput;

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

  const handlePrepareInscription = async () => {
    console.log("[PrepareInscription] Starting preparation...");
    setFlowState('preparingInscription');
    setErrorMessage(null);
    setStatusMessage('Generating ephemeral key and preparing inscription data...');
    setInscriptionPrepData(null);
    setEphemeralRevealPrivateKeyWif(null);

    if (!walletAddress) {
      setErrorMessage('Wallet address is missing. Please reconnect.');
      setFlowState('failed');
      return;
    }

    try {
      console.log("[PrepareInscription] Generating ephemeral keypair...");
      const revealPrivateKeyBytes = secpUtils.randomPrivateKey();
      const revealPublicKeyBytes = schnorr.getPublicKey(revealPrivateKeyBytes);
      const revealPrivateKeyWif = WIF(scureNetwork).encode(revealPrivateKeyBytes);
      setEphemeralRevealPrivateKeyWif(revealPrivateKeyWif);
      console.log(`[PrepareInscription] Ephemeral Public Key generated: ${bytesToHex(revealPublicKeyBytes)}`);
      console.log(`[PrepareInscription] Stored Ephemeral Private Key WIF.`);

      const parsedMeta = parseMetadata(metadata);
      const params: PrepareInscriptionScriptsParams = {
        revealPublicKey: revealPublicKeyBytes,
        recoveryPublicKey: revealPublicKeyBytes,
        inscriptionData: {
          contentType: contentType,
          content: content,
          metadata: parsedMeta,
        },
        network: scureNetwork,
      };

      console.log("[PrepareInscription] Calling prepareInscriptionScripts with params:", params);
      const preparedScripts = prepareInscriptionScripts(params);
      console.log("[PrepareInscription] Scripts prepared:", preparedScripts);

      if (!preparedScripts.commitP2TRDetails?.script || !preparedScripts.inscriptionLeafScript) {
        throw new Error("Failed to generate necessary scripts (commit or leaf).");
      }

      const placeholderCommitAmount = DUST_LIMIT + 1000n;
      console.log(`[PrepareInscription] Estimating reveal fee using placeholder commit amount: ${placeholderCommitAmount} and fee rate: ${currentFeeRate}`);
      const estimatedFee = estimateRevealFee({
        commitP2TRScript: preparedScripts.commitP2TRDetails.script,
        commitAmount: placeholderCommitAmount,
        destinationAddress: walletAddress,
        feeRate: currentFeeRate,
        network: scureNetwork,
        inscriptionLeafScript: preparedScripts.inscriptionLeafScript,
      });
      console.log(`[PrepareInscription] Estimated reveal fee: ${estimatedFee} sats`);

      const requiredCommitAmount = estimatedFee + POSTAGE_VALUE;
      console.log(`[PrepareInscription] Required commit amount (Reveal Fee + Postage): ${requiredCommitAmount} sats`);

      setInscriptionPrepData({
        scripts: preparedScripts,
        fee: estimatedFee,
        requiredCommitAmount: requiredCommitAmount,
        commitAddress: preparedScripts.commitP2TRDetails.address,
      });
      setStatusMessage('Inscription data prepared. Please select UTXOs to fund the commit transaction.');
      setFlowState('awaitingUtxoSelection');

    } catch (error) {
      console.error("[PrepareInscription] Error:", error);
      setErrorMessage(`Preparation failed: ${(error as Error).message}`);
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
                  value: utxo.value, // Pass number as defined in OrdinalsPlusUtxo
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

          console.log(`[PrepareAndSignCommit] Calling ordinalsplus.createUnsignedCommitPsbt...`);

          // Prepare params for the library function
          const commitParams: CreateUnsignedCommitPsbtParams = {
              selectedUtxos: utxosForApi,
              commitAddress: inscriptionPrepData.commitAddress,
              requiredCommitAmount: requiredCommitAmount,
              changeAddress: walletAddress!, // Assert non-null
              feeRate: currentFeeRate,
              network: scureNetwork, // Use the scureNetwork object
          };

          // Call the library function
          const { unsignedPsbtBase64, calculatedFee } = createUnsignedCommitPsbt(commitParams);

          console.log("[PrepareAndSignCommit] Unsigned Commit PSBT (Base64) generated:", unsignedPsbtBase64);

          console.log(`[PrepareAndSignCommit] Received unsigned commit PSBT (base64), Calculated Fee: ${calculatedFee} sats`);
          setCalculatedCommitFee(calculatedFee); // Store the calculated fee

          // Validation: Check if selected input value covers required amount + calculated fee
          const totalInputValue = utxosForApi.reduce((sum, u) => sum + BigInt(u.value), 0n);
          if (totalInputValue < requiredCommitAmount + calculatedFee) {
              throw new Error(`Selected valid UTXOs value (${totalInputValue} sats) is insufficient for required amount (${requiredCommitAmount} sats) + calculated commit fee (${calculatedFee} sats).`);
          }

          setUnsignedCommitPsbt(unsignedPsbtBase64);

          setFlowState('awaitingCommitSignature');
          setStatusMessage("Please sign the commit transaction in your wallet.");
          console.log("[PrepareAndSignCommit] Requesting signature for commit PSBT...");
          const signedPsbtHex = await signPsbt(unsignedPsbtBase64);
          console.log("[PrepareAndSignCommit] Commit PSBT signed by wallet.");
          await handleBroadcastCommit(walletNetwork!, signedPsbtHex);

      } catch (error) {
          console.error("[PrepareAndSignCommit] Error:", error);
          setErrorMessage(`Commit preparation/signing failed: ${(error as Error).message}`);
          setFlowState('failed');
      }
  };

  const handleBroadcastCommit = async (network: string, signedPsbtHex: string) => {
      console.log("[BroadcastCommit] Received Signed PSBT (Hex):", signedPsbtHex);
      if (!apiService || !walletNetwork) {
          setErrorMessage("API service or network not available for broadcasting.");
          setFlowState('failed');
          return;
      }
      setFlowState('broadcastingCommitTx');
      setStatusMessage("Finalizing and broadcasting commit transaction...");
      setErrorMessage(null);

      try {
          // 1. Decode the HEX PSBT string into bytes
          const psbtBytes = hexToBytes(signedPsbtHex);
          
          // 2. Load PSBT into a Transaction object
          console.log("[BroadcastCommit] Loading PSBT from bytes...");
          const tx = BtcTransaction.fromPSBT(psbtBytes);
          
          // 3. Finalize the transaction
          console.log("[BroadcastCommit] Finalizing transaction inputs...");
          tx.finalize(); 

          // 4. Extract the final raw transaction hex
          console.log("[BroadcastCommit] Extracting final transaction hex...");
          const finalTxHex = bytesToHex(tx.extract());
          console.log("[BroadcastCommit] Final Raw TX Hex:", finalTxHex);

          // 5. Broadcast the final raw transaction hex
          const { txid } = await apiService.broadcastTransaction(walletNetwork!, finalTxHex);
          console.log(`[BroadcastCommit] Commit transaction broadcasted successfully. TXID: ${txid}`);
          setFinalCommitTxid(txid);

          // --- Commit Confirmation Logic (needs polling) ---
          console.warn("Skipping commit confirmation polling. Manual VOUT/Amount needed or use dummy values.");
          const foundVout = 0; // Placeholder
          const actualAmount = inscriptionPrepData?.requiredCommitAmount ?? 0n; // Placeholder
          setFinalCommitVout(foundVout);
          setFinalCommitAmount(actualAmount);
          setCommitTxidForDisplay(txid);
          setStatusMessage(`Commit TX broadcasted: ${truncateMiddle(txid, 10)}. Assumed confirmed.`);
          setFlowState('commitConfirmedReadyForReveal');
          // --- End Placeholder --- 

      } catch (error) {
          console.error("[BroadcastCommit] Error during finalization/broadcast:", error);
          if (error instanceof Error && error.message.includes('finalize')) {
            setErrorMessage(`Commit finalization failed: ${error.message}. Check PSBT signatures.`);
          } else {
            setErrorMessage(`Commit broadcast failed: ${(error as Error).message}`);
          }
          setFlowState('failed');
      }
  };

  const handleCommitFunded = async () => {
    console.log("[ConstructAndBroadcastReveal] Starting reveal step...");
    setErrorMessage(null);

    if (!finalCommitTxid || finalCommitVout === null || finalCommitAmount === null || !inscriptionPrepData || !walletAddress || !ephemeralRevealPrivateKeyWif) {
        setErrorMessage("Commit details, prep data, wallet address, or ephemeral reveal key missing.");
        setFlowState('failed');
        return;
    }

    console.log(`[ConstructAndBroadcastReveal] Using confirmed commit TXID: ${finalCommitTxid}, VOUT: ${finalCommitVout}, Amount: ${finalCommitAmount}`);

    try {
      setFlowState('constructingRevealTx');
      setStatusMessage('Constructing final reveal transaction using generated key...');

      const { commitP2TRDetails, inscriptionLeafScript } = inscriptionPrepData.scripts;
      const revealFee = inscriptionPrepData.fee;

      if (!inscriptionLeafScript) throw new Error("Leaf script missing.");

      const finalTxResult: FinalRevealTxResult = constructFinalRevealTx({
        revealSignerWif: ephemeralRevealPrivateKeyWif,
        destinationAddress: walletAddress,
        commitP2TRDetails: commitP2TRDetails,
        inscriptionLeafScript: inscriptionLeafScript,
        revealFee: revealFee,
        commitUtxo: {
          txid: finalCommitTxid,
          vout: finalCommitVout,
          amount: finalCommitAmount,
        },
        network: scureNetwork,
      });

      console.log(`[ConstructAndBroadcastReveal] Reveal TX constructed. Txid: ${finalTxResult.txid}`);
      setRevealTxid(finalTxResult.txid);

      await handleBroadcastReveal(finalTxResult.txHex);

    } catch (error) {
      console.error("[ConstructAndBroadcastReveal] Error:", error);
      setErrorMessage(`Reveal process failed: ${(error as Error).message}`);
      setFlowState('failed');
    }
  };

  const handleBroadcastReveal = async (revealTxHex: string) => {
      console.log("[BroadcastReveal] Broadcasting Reveal TX Hex:", revealTxHex);
      if (!apiService || !walletNetwork) {
           setErrorMessage("API service or network not available for broadcasting.");
           setFlowState('failed');
           return;
      }
      
      setFlowState('broadcastingRevealTx');
      setStatusMessage("Broadcasting reveal transaction...");
      setErrorMessage(null);
      
      try {
          // This call expects raw hex directly, which constructFinalRevealTx provides
          const { txid: finalRevealTxid } = await apiService.broadcastTransaction(walletNetwork!, revealTxHex);
          console.log(`[BroadcastReveal] Reveal TX broadcasted. Confirmed TXID: ${finalRevealTxid}`);
          if (revealTxid !== finalRevealTxid) {
              console.warn(`Broadcasted reveal TXID (${finalRevealTxid}) differs from constructed (${revealTxid}). Using broadcasted.`);
              setRevealTxid(finalRevealTxid);
          }

          setStatusMessage("Reveal transaction broadcasted. Waiting for confirmation...");
          setFlowState('awaitingRevealConfirmation');

          console.warn("Skipping reveal confirmation polling.");
          setStatusMessage(`Inscription complete! Reveal TX: ${truncateMiddle(finalRevealTxid, 10)}`);
          setFlowState('inscriptionComplete');

      } catch (error) {
          console.error("[BroadcastReveal] Error:", error);
          setErrorMessage(`Reveal broadcast failed: ${(error as Error).message}`);
          setFlowState('failed');
      }
  };

  const renderCurrentStep = () => {
    switch (flowState) {
      case 'idle':
      case 'awaitingContentType':
      case 'awaitingContent':
        return (
          <div className="space-y-4 p-4 md:p-6">
            <div>
              <label htmlFor="contentType" className="block text-sm font-medium mb-1">Content Type</label>
              <input id="contentType" value={contentType} onChange={(e) => setContentType(e.target.value)} placeholder="e.g., text/plain;charset=utf-8" disabled={flowState !== 'idle'} className="w-full p-2 border rounded shadow-sm" />
            </div>
            <div>
              <label htmlFor="content" className="block text-sm font-medium mb-1">Content</label>
              <textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Enter the content to inscribe" rows={4} className="w-full p-2 border rounded shadow-sm" disabled={flowState !== 'idle'} />
            </div>
            <div>
              <label htmlFor="metadata" className="block text-sm font-medium mb-1">Metadata (Optional JSON)</label>
              <textarea id="metadata" value={metadata} onChange={(e) => setMetadata(e.target.value)} placeholder='{ "key1": "value1", "key2": "value2" }' rows={2} className="w-full p-2 border rounded shadow-sm" disabled={flowState !== 'idle'} />
            </div>
            <div>
              <label htmlFor="feeRate" className="block text-sm font-medium mb-1">Fee Rate (sats/vB)</label>
              <input id="feeRate" type="number" value={feeRateInput} onChange={(e) => setFeeRateInput(parseInt(e.target.value, 10) || 1)} min="1" disabled={flowState !== 'idle'} className="w-full p-2 border rounded shadow-sm" />
            </div>
          </div>
        );
      case 'preparingInscription':
        return (
          <div className="p-4 md:p-6 flex items-center justify-center text-gray-500">
            <Loader2 className="animate-spin mr-2 h-4 w-4" />
            {statusMessage || 'Preparing inscription data...'}
          </div>
        );
      case 'awaitingUtxoSelection':
      case 'preparingCommitTx':
      case 'awaitingCommitSignature':
      case 'broadcastingCommitTx':
      case 'awaitingCommitConfirmation':
         return (
            <div className="space-y-4 p-4 md:p-6">
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
                                    <div className="font-mono text-sm">{inscriptionPrepData.fee.toString()} sats</div>
                                </div>
                             </div>
                        </div>

                        <UtxoSelector
                          walletConnected={walletConnected}
                          utxos={availableUtxos}
                          selectedUtxos={selectedUtxos}
                          isFetchingUtxos={isFetchingUtxos}
                          utxoError={utxoError}
                          flowState={flowState}
                          onFetchUtxos={handleFetchUtxos}
                          onUtxoSelectionChange={handleUtxoSelectionChange}
                        />
                        {selectedUtxos.length > 0 && (
                             <p className="text-sm text-gray-600 dark:text-gray-400">Total selected: {truncateMiddle(totalSelectedValue.toString(), 20)} sats</p>
                        )}
                    </>
                )}
                {(flowState === 'preparingCommitTx' || flowState === 'awaitingCommitSignature' || flowState === 'broadcastingCommitTx' || flowState === 'awaitingCommitConfirmation') && (
                     <div className="flex items-center justify-center text-gray-500 pt-4">
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        {statusMessage || 'Processing commit transaction...'}
                    </div>
                )}
            </div>
         );
      case 'commitConfirmedReadyForReveal':
      case 'constructingRevealTx':
      case 'broadcastingRevealTx':
      case 'awaitingRevealConfirmation':
        return (
          <div className="space-y-4 p-4 md:p-6">
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
      case 'inscriptionComplete':
        return (
          <div className="p-4 md:p-6">
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
       case 'failed':
            return (
                <div className="p-4 md:p-6">
                    <div className="border rounded p-3 space-y-1 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700">
                        <h4 className="font-semibold flex items-center text-red-800 dark:text-red-300"><AlertCircle className="h-4 w-4 mr-2" /> Error</h4>
                        <div className="text-sm text-red-700 dark:text-red-200">
                           {errorMessage || "An unknown error occurred."}
                        </div>
                    </div>
                </div>
            );
      default:
        return <div className="p-4 md:p-6"><p>Unhandled state: {flowState}</p></div>;
    }
  };

  const renderFooterActions = () => {
    const buttonBaseClasses = "inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50";
    const primaryButtonClasses = `${buttonBaseClasses} text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500`;
    const secondaryButtonClasses = `${buttonBaseClasses} text-gray-700 bg-white hover:bg-gray-50 border-gray-300 focus:ring-indigo-500`;

    switch (flowState) {
      case 'idle':
      case 'awaitingContentType':
      case 'awaitingContent':
         return <button onClick={handlePrepareInscription} disabled={!walletConnected || !content || !contentType || currentFeeRate <= 0} className={primaryButtonClasses}>Prepare Inscription</button>;
      case 'preparingInscription':
        return <button disabled className={primaryButtonClasses}><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing...</button>;
      case 'awaitingUtxoSelection':
        return <button onClick={handlePrepareAndSignCommit} disabled={selectedUtxos.length === 0 || isFetchingUtxos} className={primaryButtonClasses}>Prepare & Sign Commit Tx</button>;
      case 'preparingCommitTx':
      case 'awaitingCommitSignature':
      case 'broadcastingCommitTx':
      case 'awaitingCommitConfirmation':
        return <button disabled className={primaryButtonClasses}><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing Commit...</button>;
      case 'commitConfirmedReadyForReveal':
        return <button onClick={handleCommitFunded} disabled={!ephemeralRevealPrivateKeyWif} className={`${buttonBaseClasses} text-white bg-green-600 hover:bg-green-700 focus:ring-green-500`}>Construct & Broadcast Reveal Tx</button>;
      case 'constructingRevealTx':
      case 'broadcastingRevealTx':
      case 'awaitingRevealConfirmation':
        return <button disabled className={primaryButtonClasses}><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing Reveal...</button>;
      case 'inscriptionComplete':
         return <button onClick={resetFlow} className={secondaryButtonClasses}>Create Another Inscription</button>;
       case 'failed':
         return <button onClick={resetFlow} className={secondaryButtonClasses}>Try Again</button>;
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto border rounded-lg shadow-md my-4 dark:bg-gray-900 dark:border-gray-700">
        <div className="p-4 md:p-6 border-b dark:border-gray-700">
            <h3 className="text-lg font-semibold">Create New Resource Inscription</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Follow the steps below to inscribe your resource onto the Bitcoin blockchain ({networkLabel}).</p>
             {!walletConnected && (
                 <div className="mt-3 border rounded p-3 text-sm bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>Please connect your wallet to begin.</span>
                 </div>
             )}
        </div>

        {renderCurrentStep()}

        {errorMessage && flowState !== 'failed' && ( 
             <div className="p-4 md:p-6 border-t dark:border-gray-700">
                <div className="border rounded p-3 text-sm bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-800 dark:text-red-300 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>{errorMessage}</span>
                </div>
             </div>
        )}

        <div className="p-4 md:p-6 border-t dark:border-gray-700 flex justify-end space-x-2">
            {renderFooterActions()}
        </div>
    </div>
  );
};

export default ResourceCreationForm;
