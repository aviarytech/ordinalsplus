import React, { useState, useEffect, useCallback } from 'react';
import { useResourceInscription } from './ResourceInscriptionWizard';
import UtxoSelector from '../create/UtxoSelector';
import { useWallet, Utxo } from '../../context/WalletContext';
import { Button } from '../ui';
import { AlertCircle, Info, Edit, Check } from 'lucide-react';

/**
 * UTXOSelectionStep handles the selection of a UTXO for the resource inscription.
 * This is the first step where the user selects which sat will be inscribed.
 */
const UTXOSelectionStep: React.FC = () => {
  const { state, setUtxoSelection, nextStep, setError, clearError } = useResourceInscription();
  const { 
    connected: walletConnected,
    getUtxos,
    address
  } = useWallet();
  
  // State for UTXOs and UI
  const [availableUtxos, setAvailableUtxos] = useState<Utxo[]>([]);
  const [isFetchingUtxos, setIsFetchingUtxos] = useState<boolean>(false);
  const [utxoError, setUtxoError] = useState<string | null>(null);
  const [showGuidance, setShowGuidance] = useState<boolean>(false);
  const [manualSelectionMode, setManualSelectionMode] = useState<boolean>(false);
  
  // Format satoshi values to BTC
  const formatBtcValue = (satoshis: number): string => {
    return (satoshis / 100_000_000).toFixed(8);
  };

  // Find the largest UTXO from the available UTXOs
  const findLargestUtxo = (utxos: Utxo[]): Utxo | null => {
    if (!utxos || utxos.length === 0) return null;
    
    return utxos.reduce((largest, current) => {
      return current.value > largest.value ? current : largest;
    }, utxos[0]);
  };

  // Fetch UTXOs from wallet
  const handleFetchUtxos = async () => {
    if (!walletConnected) {
      setUtxoError('Wallet not connected');
      setError('utxoSelection', 'Please connect your wallet to continue');
      return;
    }
    
    if (!address) {
      setUtxoError('Wallet address not available');
      setError('utxoSelection', 'Wallet address not available');
      return;
    }
    
    setIsFetchingUtxos(true);
    setUtxoError(null);
    clearError('utxoSelection');
    
    try {
      const utxos = await getUtxos();
      
      if (utxos.length === 0) {
        setUtxoError('No UTXOs found in your wallet');
        setError('utxoSelection', 'No UTXOs available');
      } else {
        setAvailableUtxos(utxos);
        clearError('utxoSelection');
        
        // Automatically select the largest UTXO if not in manual mode
        // and if no UTXO is currently selected
        if (!manualSelectionMode && state.utxoSelection.length === 0) {
          const largestUtxo = findLargestUtxo(utxos);
          if (largestUtxo) {
            setUtxoSelection([largestUtxo]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching UTXOs:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch UTXOs from wallet';
      setUtxoError(errorMessage);
      setError('utxoSelection', errorMessage);
    } finally {
      setIsFetchingUtxos(false);
    }
  };
  
  // Handle UTXO selection change
  const handleUtxoSelectionChange = (utxo: Utxo, isSelected: boolean) => {
    // For resource inscriptions, we only need one UTXO to inscribe on
    // This simplifies the selection to just the primary UTXO
    if (isSelected) {
      // Set this as the only selected UTXO
      setUtxoSelection([utxo]);
      clearError('utxoSelection');
    } else {
      // If deselecting the current UTXO, clear the selection
      setUtxoSelection([]);
      // Only set error after user has interacted with the component
      handleUtxoInteraction();
    }
  };
  
  // Toggle between automatic and manual selection modes
  const toggleSelectionMode = () => {
    const newMode = !manualSelectionMode;
    setManualSelectionMode(newMode);
    
    // If switching back to automatic mode and we have UTXOs, select the largest one
    if (!newMode && availableUtxos.length > 0) {
      const largestUtxo = findLargestUtxo(availableUtxos);
      if (largestUtxo) {
        setUtxoSelection([largestUtxo]);
      }
    }
  };
  
  // Continue to next step
  const handleContinue = () => {
    // Validate that a UTXO is selected before proceeding
    if (state.utxoSelection.length === 0) {
      setError('utxoSelection', 'Please select a UTXO for inscription');
      return;
    }
    
    // Check if the UTXO is confirmed (optional warning)
    const selectedUtxo = state.utxoSelection[0];
    const utxoStatus = (selectedUtxo as any).status;
    if (utxoStatus && utxoStatus.confirmed === false) {
      // Just log a warning but allow proceeding
      console.warn('Selected UTXO is unconfirmed, which may cause issues with the inscription');
    }
    
    // Proceed to next step
    clearError('utxoSelection');
    nextStep();
  };
  
  // Fetch UTXOs on component mount if wallet is connected
  useEffect(() => {
    if (walletConnected && availableUtxos.length === 0) {
      handleFetchUtxos();
    }
  }, [walletConnected]);
  
  // Clear any errors on initial load and only set errors after user interaction
  useEffect(() => {
    // Clear any existing errors on component mount
    clearError('utxoSelection');
  }, [clearError]);
  
  // Only set error when user has interacted with UTXOs but hasn't selected any
  const handleUtxoInteraction = useCallback(() => {
    if (state.utxoSelection.length === 0 && availableUtxos.length > 0) {
      setError('utxoSelection', 'Please select a UTXO for inscription');
    } else if (state.utxoSelection.length > 0) {
      clearError('utxoSelection');
    }
  }, [state.utxoSelection.length, availableUtxos.length, setError, clearError]);
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          Select a Sat for Inscription
        </h2>
        <button
          type="button"
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          onClick={() => setShowGuidance(!showGuidance)}
          aria-label={showGuidance ? "Hide guidance" : "Show guidance"}
        >
          <Info className="h-5 w-5" />
        </button>
      </div>
      
      {/* UTXO Selection Guide - hidden by default */}
      {showGuidance && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md text-sm text-blue-800 dark:text-blue-200 mb-4">
          <h3 className="font-medium mb-2">About Sat Selection</h3>
          <p className="mb-2">Select a UTXO that contains the sat you want to inscribe your resource on.</p>
          <ul className="list-disc list-inside space-y-1 mb-2">
            <li><span className="font-medium">Confirmed UTXOs</span> are recommended for reliable inscriptions.</li>
            <li><span className="font-medium">Automatic selection</span> chooses the largest UTXO by default.</li>
            <li><span className="font-medium">Manual selection</span> allows you to choose any UTXO.</li>
          </ul>
          <p>Wallet: {address ? <span className="font-medium">{address.substring(0, 8)}...{address.substring(address.length - 8)}</span> : 'Not connected'}</p>
        </div>
      )}
      
      {/* Error display - only show after user has interacted with UTXOs */}
      {state.errors.utxoSelection && availableUtxos.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-md flex items-start text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <div>{state.errors.utxoSelection}</div>
        </div>
      )}
      
      {/* Selection Mode Toggle */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">Selection Mode: </span>
          {manualSelectionMode ? (
            <span className="text-amber-600 dark:text-amber-400">Manual Selection</span>
          ) : (
            <span className="text-green-600 dark:text-green-400">Automatic (Largest UTXO)</span>
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
      
      {/* UTXO Selection summary - simplified */}
      {state.utxoSelection.length > 0 && (
        <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-md text-sm text-green-800 dark:text-green-200">
          <h3 className="font-medium mb-1">Selected Sat</h3>
          <div className="mt-1">
            <p className="text-xs">UTXO: 
              <span className="font-mono ml-1">{state.utxoSelection[0].txid.substring(0, 8)}...:{state.utxoSelection[0].vout}</span>
              {(state.utxoSelection[0] as any).status?.confirmed === false && (
                <span className="ml-2 text-amber-600 dark:text-amber-400">(Unconfirmed)</span>
              )}
            </p>
            <p className="text-xs mt-1">Value: <span className="font-medium">{formatBtcValue(state.utxoSelection[0].value)} BTC</span></p>
          </div>
        </div>
      )}
      
      {/* Only show the UTXO selector in manual mode or when no UTXOs are selected */}
      {(manualSelectionMode || state.utxoSelection.length === 0) && (
        <UtxoSelector
          walletConnected={walletConnected}
          utxos={availableUtxos}
          selectedUtxos={state.utxoSelection}
          isFetchingUtxos={isFetchingUtxos}
          utxoError={utxoError}
          flowState="awaitingUtxoSelection"
          onFetchUtxos={handleFetchUtxos}
          onUtxoSelectionChange={handleUtxoSelectionChange}
          requiredAmount={0} /* Removed minimum required funds */
        />
      )}
      
      <div className="flex justify-between mt-6">
        <div className="text-sm text-gray-500 dark:text-gray-400 self-center">
          {state.utxoSelection.length > 0 ? (
            <span className="text-green-600 dark:text-green-400">✓ Ready to continue</span>
          ) : (
            <span>Please select a UTXO for inscription</span>
          )}
        </div>
        <Button
          onClick={handleContinue}
          disabled={state.utxoSelection.length === 0}
          className="px-4 py-2"
        >
          Continue
        </Button>
      </div>
    </div>
  );
};

export default UTXOSelectionStep;
