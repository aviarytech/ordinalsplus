import React from 'react';

/**
 * Mock UtxoSelector component for testing
 * This avoids having to render the actual component with all its dependencies
 */
export const MockUtxoSelector = ({ 
  walletConnected, 
  utxos, 
  selectedUtxos, 
  isFetchingUtxos, 
  utxoError, 
  flowState, 
  onFetchUtxos, 
  onUtxoSelectionChange,
  requiredAmount 
}: any) => {
  return (
    <div data-testid="utxo-selector">
      <div data-testid="wallet-connected">{String(walletConnected)}</div>
      <div data-testid="utxos-count">{utxos?.length || 0}</div>
      <div data-testid="selected-count">{selectedUtxos?.length || 0}</div>
      <div data-testid="is-fetching">{String(isFetchingUtxos)}</div>
      <div data-testid="error">{utxoError || 'none'}</div>
      <div data-testid="flow-state">{flowState}</div>
      <div data-testid="required-amount">{requiredAmount}</div>
      
      {utxos?.map((utxo: any, index: number) => (
        <div key={`${utxo.txid}:${utxo.vout}`} data-testid={`utxo-${index}`}>
          <div data-testid={`txid-${index}`}>
            {`${utxo.txid.substring(0, 4)}...${utxo.txid.substring(utxo.txid.length - 4)}:${utxo.vout}`}
          </div>
          <div data-testid={`value-${index}`}>
            {`${(utxo.value / 100_000_000).toFixed(8)} BTC`}
          </div>
          <div data-testid={`status-${index}`}>
            {utxo.status?.confirmed ? 'Confirmed' : 'Unconfirmed'}
          </div>
          <button 
            data-testid={`select-${index}`}
            onClick={() => onUtxoSelectionChange(utxo, !selectedUtxos?.includes(utxo))}
          >
            {selectedUtxos?.includes(utxo) ? 'Deselect' : 'Select'}
          </button>
        </div>
      ))}

      <button 
        data-testid="refresh-button"
        onClick={onFetchUtxos} 
        aria-label="refresh"
      >
        Refresh UTXOs
      </button>
      
      {utxos?.length === 0 && (
        <button 
          data-testid="load-button"
          onClick={onFetchUtxos} 
          aria-label="load available utxos"
        >
          Load Available UTXOs
        </button>
      )}
      
      {/* Guidance text */}
      <div data-testid="guidance-text">
        <p>Choosing the right UTXOs is important for inscriptions</p>
        <p>Select UTXOs with enough funds to cover the inscription and fees</p>
        <p>Prefer confirmed UTXOs to avoid transaction failures</p>
        <p>The first input UTXO will hold your inscription</p>
        <p>You need at least {(requiredAmount / 100_000_000).toFixed(8)} BTC to cover this inscription</p>
      </div>
      
      <button 
        aria-label="show guidance" 
        data-testid="toggle-guidance"
      >
        Toggle Guidance
      </button>
      
      {/* Filter/Sorting buttons */}
      <div data-testid="filter-sort-controls">
        <button aria-label="value">Sort by Value</button>
        <button aria-label="age">Sort by Age</button>
        <button aria-label="all">All</button>
        <button aria-label="recommended">Recommended</button>
        <button aria-label="confirmed">Confirmed</button>
      </div>
      
      {selectedUtxos?.length > 0 && (
        <div data-testid="selection-summary">
          <p>Selected: {selectedUtxos.length} UTXO</p>
          <p>Total: {(selectedUtxos.reduce((acc: number, utxo: any) => acc + utxo.value, 0) / 100_000_000).toFixed(8)} BTC</p>
        </div>
      )}
      
      {isFetchingUtxos && (
        <div data-testid="loading-indicator">
          Fetching UTXOs...
        </div>
      )}
    </div>
  );
}; 