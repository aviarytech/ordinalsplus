import React, { useEffect, useMemo, useState } from 'react';
import { useResourceInscription } from './ResourceInscriptionWizard';
import { useApi } from '../../context/ApiContext';
import { Button } from '../ui';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface BatchItem {
  id: string;
  label?: string;
  contentType?: string;
  contentSize?: number;
  satoshi?: string;
  status: string;
  transactions?: { commit?: string; reveal?: string };
}

const BatchSummaryStep: React.FC = () => {
  const { state, previousStep } = useResourceInscription();
  const { apiService } = useApi();
  const [items, setItems] = useState<BatchItem[]>(() => (state.batchResult?.items as any) || []);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Manual refresh instead of auto-polling
  const refreshItems = async () => {
    try {
      setIsPolling(true);
      if (apiService && items.length) {
        const updated = await Promise.all(
          items.map(async (it: any) => {
            if (!it?.id) return it;
            try {
              const fresh = await apiService.getResourceInscription(it.id);
              return { ...it, ...fresh };
            } catch {
              return it;
            }
          })
        );
        setItems(updated as any);
      } else {
        setItems(prev => prev && prev.length ? prev : ((state.batchResult?.items as any) || []));
      }
    } finally {
      setIsPolling(false);
    }
  };

  const network = useMemo(() => {
    // Try to read selected network from localStorage (same as apiService context fallback)
    try { return localStorage.getItem('currentNetwork') || 'mainnet'; } catch { return 'mainnet'; }
  }, []);

  const handlePrepare = async (id: string) => {
    if (!apiService) return;
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await apiService.prepareResourceInscription(id, network);
      // Force refresh of this item
      const fresh = await apiService.getResourceInscription(id);
      setItems(prev => prev.map(it => it.id === id ? { ...it, ...fresh } : it));
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleAcceptCommit = async (id: string) => {
    if (!apiService) return;
    const commitTxid = prompt('Enter commit txid for this item');
    if (!commitTxid) return;
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await apiService.acceptCommitForResourceInscription(id, commitTxid);
      const fresh = await apiService.getResourceInscription(id);
      setItems(prev => prev.map(it => it.id === id ? { ...it, ...fresh } : it));
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleFinalizeReveal = async (id: string) => {
    if (!apiService) return;
    const revealTxid = prompt('Enter reveal txid for this item');
    if (!revealTxid) return;
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await apiService.finalizeRevealForResourceInscription(id, revealTxid);
      const fresh = await apiService.getResourceInscription(id);
      setItems(prev => prev.map(it => it.id === id ? { ...it, ...fresh } : it));
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Batch Summary</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">Your batch has started. This view summarizes each item and will refresh statuses automatically.</p>

      <div className="border rounded-md divide-y divide-gray-200 dark:divide-gray-700">
        {(items || []).map((item) => (
          <div key={item.id} className="p-3">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-sm">
              <div>
                <div className="text-gray-700 dark:text-gray-300 font-medium">{item.label || 'File'}</div>
                <div className="text-gray-500 dark:text-gray-400">{item.contentType}</div>
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" disabled={actionLoading[item.id]} onClick={() => handlePrepare(item.id)}>Prepare</Button>
                <Button size="sm" variant="outline" disabled={actionLoading[item.id]} onClick={() => handleAcceptCommit(item.id)}>Accept Commit</Button>
                <Button size="sm" variant="outline" disabled={actionLoading[item.id]} onClick={() => handleFinalizeReveal(item.id)}>Finalize Reveal</Button>
              </div>
              <div className="text-gray-700 dark:text-gray-300">{item.contentSize ? `${item.contentSize} bytes` : '-'}</div>
              <div className="text-gray-700 dark:text-gray-300">Sat: {item.satoshi || '-'}</div>
              <div className="text-gray-700 dark:text-gray-300">Status: <span className="font-mono">{item.status}</span></div>
              <div className="text-gray-700 dark:text-gray-300">
                {item.transactions?.commit && (
                  <div className="truncate">Commit: <span className="font-mono">{item.transactions.commit}</span></div>
                )}
                {item.transactions?.reveal && (
                  <div className="truncate">Reveal: <span className="font-mono">{item.transactions.reveal}</span></div>
                )}
              </div>
            </div>
            <div className="mt-2">
              <button
                className="text-xs text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1"
                onClick={() => setExpanded(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
              >
                {expanded[item.id] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} View details
              </button>
              {expanded[item.id] && (
                <pre className="mt-2 text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-auto border border-gray-200 dark:border-gray-700">{JSON.stringify(item, null, 2)}</pre>
              )}
            </div>
            {(() => {
              const base = (() => { try { return localStorage.getItem('VITE_ORD_BASE') || (import.meta as any)?.env?.VITE_ORD_BASE || ''; } catch { return ''; } })();
              const ordBase = base ? String(base).replace(/\/$/, '') : '';
              const inscId = (item as any)?.inscriptionId || item?.transactions?.reveal;
              if (!ordBase || !inscId) return null;
              return (
                <div className="mt-2 text-xs">
                  <a className="text-indigo-600 dark:text-indigo-400 underline" href={`${ordBase}/inscription/${inscId}`} target="_blank" rel="noreferrer">View inscription</a>
                  <span className="mx-2">·</span>
                  <a className="text-indigo-600 dark:text-indigo-400 underline" href={`${ordBase}/content/${inscId}`} target="_blank" rel="noreferrer">Content</a>
                </div>
              );
            })()}
          </div>
        ))}
        {items.length === 0 && (
          <div className="p-3 text-sm text-gray-500 dark:text-gray-400">No items to display.</div>
        )}
      </div>

      <div className="flex justify-between">
        <Button onClick={previousStep} variant="outline" className="px-4 py-2">Back</Button>
        <div className="flex gap-2">
          <Button variant="outline" disabled={isPolling} className="px-4 py-2" onClick={refreshItems}>{isPolling ? 'Refreshing…' : 'Refresh'}</Button>
          <Button disabled={isPolling} className="px-4 py-2">Continue</Button>
        </div>
      </div>
    </div>
  );
};

export default BatchSummaryStep;


