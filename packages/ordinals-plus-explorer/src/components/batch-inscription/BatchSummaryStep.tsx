import React, { useEffect, useMemo, useState } from 'react';
import { useApi } from '../../context/ApiContext';
import { useWallet } from '../../context/WalletContext';
import { Button } from '../ui';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { finalizeAndExtractTransaction, prepareResourceInscription, inscribeWithSatpoint, prepareBatchCommitTransaction } from 'ordinalsplus';
import { utils as secpUtils } from '@noble/secp256k1';
import * as scureBtc from '@scure/btc-signer';

interface BatchItem {
  id: string;
  label?: string;
  contentType?: string;
  contentSize?: number;
  satoshi?: string;
  status: string;
  inscriptionId?: string;
  transactions?: { commit?: string; reveal?: string };
  prepared?: {
    commitAddress: string;
    commitScriptHex?: string;
    controlBlockHex?: string;
    revealPublicKeyHex?: string;
    leafVersion?: number;
    requiredCommitAmount: number;
    estimatedRevealFee: number;
    network: string;
  };
}

interface BatchPackageFile { name: string; path?: string; file: File }
interface BatchPackageState { files: BatchPackageFile[]; manifest?: any }
interface Props { items?: BatchItem[]; pkg?: BatchPackageState }

const BatchSummaryStep: React.FC<Props> = ({ items: initialItems = [], pkg }) => {
  const { apiService } = useApi();
  const { address, getUtxos, signPsbt, network: walletNetwork } = useWallet();
  const [items, setItems] = useState<BatchItem[]>(initialItems);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [satpointsByItem, setSatpointsByItem] = useState<Record<string, string>>({});
  const [availableUtxos, setAvailableUtxos] = useState<any[]>([]);
  const [isFetchingUtxos, setIsFetchingUtxos] = useState<boolean>(false);
  const [selectedFundingUtxo, setSelectedFundingUtxo] = useState<any | null>(null);
  const [diagramItems, setDiagramItems] = useState<Array<{ index: number; label: string; contentType: string; bytes: number; sat?: number }>>([]);
  const [sharedCommitTxid, setSharedCommitTxid] = useState<string | undefined>(undefined);

  // Human-readable formatter for bytes in summary
  const formatBytes = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    const decimals = n < 10 && i > 0 ? 2 : 0;
    return `${n.toFixed(decimals)} ${units[i]}`;
  };
  const totalBytes = useMemo(() => diagramItems.reduce((sum, it) => sum + (it.bytes || 0), 0), [diagramItems]);

  useEffect(() => {
    if (initialItems && initialItems.length) setItems(initialItems);
  }, [initialItems]);

  const network = useMemo(() => {
    try { return localStorage.getItem('ordinalsplus_selected_network_id') || 'mainnet'; } catch { return 'mainnet'; }
  }, []);
  const ordBase = useMemo(() => {
    const base = (pkg as any)?.manifest?.ordApiBase;
    if (base) return base.replace(/\/$/, '');
    const env = (import.meta as any)?.env?.VITE_ORD_BASE;
    return env ? String(env).replace(/\/$/, '') : '';
  }, [pkg]);
  const manifestHasSatpoints = useMemo(() => !!(pkg as any)?.manifest?.satpoints, [pkg]);
  const hasAnySatpoints = useMemo(() => {
    return manifestHasSatpoints || Object.keys(satpointsByItem).length > 0;
  }, [manifestHasSatpoints, satpointsByItem]);

  // Build visual diagram data from manifest + package files; compute sat numbers if possible
  useEffect(() => {
    (async () => {
      try {
        const manifestFiles = Array.isArray((pkg as any)?.manifest?.files) ? ((pkg as any).manifest.files as Array<{ file: string; contentType?: string }>) : [];
        if (!manifestFiles.length) { setDiagramItems([]); return; }

        // Determine shared commit txid (for combined commit flow)
        const commits = new Set<string>();
        for (const it of items || []) { const c = it?.transactions?.commit; if (c) commits.add(c); }
        setSharedCommitTxid(commits.size === 1 ? Array.from(commits)[0] : undefined);

        // Optional sat number computation when fundingUtxo is provided
        const fundingUtxo: string | undefined = (pkg as any)?.manifest?.fundingUtxo;
        const postage: number = Number(((pkg as any)?.manifest?.postage ?? 551));
        let satNumbers: number[] | undefined = undefined;
        if (fundingUtxo && apiService) {
          try {
            const start = await apiService.getSatNumber(network, fundingUtxo);
            if (typeof start === 'number') {
              satNumbers = manifestFiles.map((_, i) => start + postage * i);
            }
          } catch {
            // ignore sat number errors in summary view
          }
        }

        const findFile = (label: string): File | undefined => {
          const files: Array<{ name: string; path?: string; file: File }> = (pkg as any)?.files || [];
          let entry = files.find(f => f.path === label || f.name === label);
          if (entry) return entry.file;
          entry = files.find(f => f.path?.endsWith(`/${label}`));
          return entry?.file;
        };

        const preview: Array<{ index: number; label: string; contentType: string; bytes: number; sat?: number }> = [];
        for (let i = 0; i < manifestFiles.length; i++) {
          const mf = manifestFiles[i];
          const f = findFile(mf.file);
          preview.push({
            index: i,
            label: mf.file,
            contentType: mf.contentType || 'application/octet-stream',
            bytes: f ? f.size : 0,
            sat: Array.isArray(satNumbers) ? satNumbers[i] : undefined
          });
        }
        setDiagramItems(preview);
      } catch {
        setDiagramItems([]);
      }
    })();
  }, [apiService, network, pkg, items]);

  // If manifest specifies a funding UTXO, pre-select it
  useEffect(() => {
    const m = (pkg as any)?.manifest;
    if (!m?.fundingUtxo) return;
    (async () => {
      try {
        if (!availableUtxos.length) {
          const utxos = await getUtxos();
          setAvailableUtxos(utxos || []);
        }
        const val: string = m.fundingUtxo;
        const [txid, voutStr] = val.split(':');
        const vout = Number(voutStr);
        if (txid && !Number.isNaN(vout)) {
          const match = (availableUtxos.length ? availableUtxos : await getUtxos()).find((u: any) => u.txid === txid && u.vout === vout);
          if (match) setSelectedFundingUtxo(match);
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg]);

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
      }
    } finally {
      setIsPolling(false);
    }
  };

  const handlePrepare = async (id: string) => {
    if (!apiService) return;
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      if (!address) { alert('Connect wallet first'); return; }
      await apiService.prepareResourceInscription(id, network, address);
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

  const setItemSatpoint = (id: string) => {
    const current = satpointsByItem[id] || '';
    const input = prompt('Enter satpoint for this item (format: txid:vout[:offset])', current);
    if (!input) return;
    const trimmed = input.trim();
    const satpointRegex = /^[0-9a-fA-F]{64}:[0-9]+(?::[0-9]+)?$/;
    if (!satpointRegex.test(trimmed)) {
      alert('Invalid satpoint format. Expected txid:vout or txid:vout:offset');
      return;
    }
    setSatpointsByItem(prev => ({ ...prev, [id]: trimmed }));
  };

  const fetchFundingUtxos = async () => {
    try {
      setIsFetchingUtxos(true);
      const utxos = await getUtxos();
      setAvailableUtxos(utxos || []);
    } catch {
      setAvailableUtxos([]);
    } finally {
      setIsFetchingUtxos(false);
    }
  };

  // Open wallet with bitcoin: URI for the prepared commit payment
  const openWalletToPay = (item: BatchItem) => {
    try {
      const commitAddress = item?.prepared?.commitAddress;
      const amountSats = item?.prepared?.requiredCommitAmount;
      if (!commitAddress || !amountSats) return;
      const btcAmount = (amountSats / 100000000).toFixed(8);
      const uri = `bitcoin:${commitAddress}?amount=${btcAmount}`;
      // Prefer navigation to trigger OS/wallet handler reliably
      window.location.href = uri;
      // Fallback for some browsers/extensions: programmatically click an anchor
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = uri;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, 100);
    } catch {
      // ignore
    }
  };

  // Build & sign a single commit PSBT with multiple commit outputs using ordinalsplus helper, then broadcast
  const handleBuildSignCombinedCommit = async () => {
    if (manifestHasSatpoints) { alert('Manifest specifies satpoints. Combined commit is not allowed. Use "Run Using Satpoints".'); return; }
    if (!address || !signPsbt || !getUtxos) { alert('Connect wallet first'); return; }
    try {
      // Normalize network from wallet
      const walletNet = walletNetwork === 'mainnet' ? 'mainnet' : (walletNetwork === 'signet' ? 'signet' : 'testnet');

      // Helper: locate file blob from package by label or suffix match
      const findFileBlob = (label?: string): File | undefined => {
        if (!pkg?.files || !label) return undefined;
        const exact = pkg.files.find(f => f.path === label || f.name === label);
        if (exact) return exact.file;
        const suff = pkg.files.find(f => f.path?.endsWith(`/${label}`));
        return suff?.file;
      };

      // Build list of PreparedInscription objects (or minimal shape) for batch helper
      const preparedList: any[] = [];
      for (const it of items) {
        // If backend already provided a valid commit address, just use it
        const addr = it.prepared?.commitAddress;
        if (addr && typeof addr === 'string') {
          preparedList.push({ commitAddress: { address: addr } });
          continue;
        }
        // Otherwise prepare locally from the uploaded file
        const file = findFileBlob(it.label);
        if (!file) continue;
        const buf = new Uint8Array(await file.arrayBuffer());
        const revealPriv = secpUtils.randomPrivateKey();
        const revealPub = scureBtc.utils.pubSchnorr(revealPriv);
        const prep = await prepareResourceInscription({
          content: buf,
          contentType: it.contentType || 'application/octet-stream',
          resourceType: 'resource',
          publicKey: revealPub,
          recipientAddress: address,
          feeRate: 10,
          network: walletNet,
          metadata: (it as any)?.metadata || {}
        } as any);
        preparedList.push(prep.preparedInscription);
      }

      if (!preparedList.length) { alert('No prepared items found'); return; }

      // Fetch UTXOs from wallet
      const utxos = await getUtxos();
      if (!utxos.length) { alert('No UTXOs available in wallet'); return; }

      // Prepare batch commit PSBT using library helper
      const postage = ((pkg as any)?.manifest?.postage ?? 1000) as number; // sats per output
      const feeRate = ((pkg as any)?.manifest?.feeRate ?? 10) as number; // sats/vB
      let effectiveFeeRate = feeRate;
      const buildBatch = async (rate: number) => await prepareBatchCommitTransaction({
        inscriptions: preparedList as any,
        utxos: utxos as any,
        changeAddress: address,
        feeRate: rate,
        network: walletNet as any,
        postage,
        selectedInscriptionUtxo: selectedFundingUtxo || undefined
      });

      let batch = await buildBatch(effectiveFeeRate);

      // Sign PSBT via wallet
      const signedPsbtHex = await signPsbt(batch.commitPsbtBase64);

      // Finalize, extract, and broadcast
      const txHex = finalizeAndExtractTransaction(signedPsbtHex);
      let commitTxid: string | undefined;
      try {
        const resp = await apiService?.broadcastTransaction(walletNet, txHex as string);
        commitTxid = ((resp as any)?.txid || resp) as string;
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (msg.includes('insufficient fee') && msg.includes('rejecting replacement')) {
          // Bump fee rate by +1 sat/vB and retry once
          effectiveFeeRate = Math.max(effectiveFeeRate + 1, Math.ceil(effectiveFeeRate + 1));
          const bumped = await buildBatch(effectiveFeeRate);
          const bumpedSigned = await signPsbt(bumped.commitPsbtBase64);
          const bumpedHex = finalizeAndExtractTransaction(bumpedSigned);
          const resp2 = await apiService?.broadcastTransaction(walletNet, bumpedHex as string);
          commitTxid = ((resp2 as any)?.txid || resp2) as string;
        } else {
          throw e;
        }
      }

      // Update each item with the shared commit txid
      for (const it of items) {
        if (it.id) {
          await apiService?.acceptCommitForResourceInscription(it.id, commitTxid);
        }
      }
      // Refresh items from backend
      const updated = await Promise.all(items.map(async it => it.id ? (await apiService!.getResourceInscription(it.id)) : it));
      setItems(updated as any);
      alert(`Combined commit transaction broadcasted at ${effectiveFeeRate} sat/vB`);
    } catch (e: any) {
      alert(`Failed to build/sign combined commit: ${e?.message || e}`);
    }
  };

  // Per-item: Build & sign commit using satpoint (per-item selection or manifest) to ensure correct sat selection
  const handleCommitWithSatpoint = async (item: BatchItem) => {
    if (!address || !signPsbt || !getUtxos || !apiService) { alert('Connect wallet first'); return; }
    try {
      // Determine satpoint: prefer per-item selection, then manifest mapping by extension
      const label = item.label || '';
      const ext = (label.split('.').pop() || '').toLowerCase();
      const selectedSatpoint = satpointsByItem[item.id];
      const manifestSatpoint = (pkg as any)?.manifest?.satpoints?.[ext];
      const satpoint = selectedSatpoint || manifestSatpoint;
      if (!satpoint || typeof satpoint !== 'string') { alert('No satpoint selected. Set one for this item first.'); return; }

      // Fetch wallet UTXOs
      const utxos = await getUtxos();

      // Find file content
      const findFileBlob = (lbl?: string): File | undefined => {
        if (!pkg?.files || !lbl) return undefined;
        const exact = pkg.files.find(f => f.path === lbl || f.name === lbl);
        if (exact) return exact.file;
        const suff = pkg.files.find(f => f.path?.endsWith(`/${lbl}`));
        return suff?.file;
      };
      const file = findFileBlob(item.label);
      if (!file) { alert('Source file not available to prepare inscription'); return; }
      const contentBuffer = new Uint8Array(await file.arrayBuffer());

      const walletNet = walletNetwork === 'mainnet' ? 'mainnet' : (walletNetwork === 'signet' ? 'signet' : 'testnet');

      // Provide broadcaster that also updates backend state
      const broadcast = async (txHex: string, phase: 'commit' | 'reveal') => {
        const resp = await apiService.broadcastTransaction(walletNet, txHex as string);
        const txid = (resp as any)?.txid || resp;
        if (phase === 'commit') {
          await apiService.acceptCommitForResourceInscription(item.id, txid);
        } else {
          await apiService.finalizeRevealForResourceInscription(item.id, txid);
        }
        return txid as string;
      };

      // Run end-to-end inscription with satpoint
      // Allow persisted fee rate override from manifest or localStorage
      let feeRate = Number((pkg as any)?.manifest?.feeRate);
      if (!Number.isFinite(feeRate) || feeRate <= 0) {
        try { const saved = Number(localStorage.getItem('ordinalsplus_batch_fee_rate') || ''); if (Number.isFinite(saved) && saved > 0) feeRate = saved; } catch {}
      }
      if (!Number.isFinite(feeRate) || feeRate <= 0) feeRate = 10;

      await inscribeWithSatpoint({
        content: Buffer.from(contentBuffer),
        contentType: item.contentType || 'application/octet-stream',
        recipientAddress: address,
        utxos: utxos as any,
        feeRate,
        network: walletNet as any,
        satpoint,
        // Preserve metadata from the created item (e.g., uploaded VC)
        metadata: (item as any)?.metadata || {},
        signPsbt: async (psbtBase64: string) => await signPsbt(psbtBase64),
        broadcast
      });

      // Refresh item from backend after commit/reveal
      const fresh = await apiService.getResourceInscription(item.id);
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, ...fresh } : it));
      alert(`Commit and reveal broadcasted for ${item.label}`);
    } catch (e: any) {
      alert(`Failed commit with satpoint: ${e?.message || e}`);
    }
  };

  // Run satpoint-enforced commits for all items sequentially
  const handleRunAllWithSatpoints = async () => {
    if (!manifestHasSatpoints) { alert('No satpoints found in manifest.'); return; }
    for (const it of items) {
      try {
        await handleCommitWithSatpoint(it);
      } catch (e) {
        break;
      }
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Batch Summary</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">Your batch has started. This view summarizes each item and will refresh statuses automatically.</p>

      {diagramItems.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded p-3 space-y-2">
          <div className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">Transaction Overview</div>
          <div className="text-xs text-yellow-800 dark:text-yellow-200">Visual mapping of the commit input to reveal outputs.</div>
          <div className="text-xs text-yellow-900 dark:text-yellow-100 mt-1">
            {diagramItems.length} file{diagramItems.length!==1?'s':''} • Total size: {formatBytes(totalBytes)} ({totalBytes} bytes)
          </div>

          <div className="mt-2 bg-white/60 dark:bg-gray-800/60 rounded p-3 border border-yellow-200/60 dark:border-yellow-700/60">
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                <div className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Input (Reveal)</div>
                  <div className="text-xs font-mono break-all text-gray-800 dark:text-gray-100">
                    {sharedCommitTxid ? `${sharedCommitTxid.slice(0, 12)}…:0` : 'commitTxid:0'}
                  </div>
                  <div className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                    Value: unknown
                  </div>
                </div>
              </div>
              <div className="col-span-2 flex justify-center">
                <div className="text-gray-600 dark:text-gray-300">→</div>
              </div>
              <div className="col-span-5">
                <div className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Outputs</div>
                  <div className="space-y-2 max-h-40 overflow-auto pr-1">
                    {diagramItems.map((it) => (
                      <div key={`sum-viz-${it.index}`} className="flex items-center gap-2">
                        <div className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600">
                          #{it.index}
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-mono break-all text-gray-800 dark:text-gray-100">{it.label}</div>
                          <div className="text-[11px] text-gray-600 dark:text-gray-300">
                            {formatBytes(it.bytes)} ({it.bytes} bytes) • {(((pkg as any)?.manifest?.postage ?? 551) as number)} sats{it.sat !== undefined ? ` • sat ${it.sat}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border rounded-md divide-y divide-gray-200 dark:divide-gray-700">
        {(items || []).map((item) => (
          <div key={item.id} className="p-3">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-sm">
              <div>
                <div className="text-gray-700 dark:text-gray-300 font-medium">{item.label || 'File'}</div>
                <div className="text-gray-500 dark:text-gray-400">{item.contentType}</div>
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
            {(() => {
              const inscId = item?.inscriptionId || item?.transactions?.reveal;
              if (!ordBase || !inscId) return null;
              return (
                <div className="mt-2 text-xs">
                  <a className="text-indigo-600 dark:text-indigo-400 underline" href={`${ordBase}/inscription/${inscId}`} target="_blank" rel="noreferrer">View inscription</a>
                  <span className="mx-2">·</span>
                  <a className="text-indigo-600 dark:text-indigo-400 underline" href={`${ordBase}/content/${inscId}`} target="_blank" rel="noreferrer">Content</a>
                </div>
              );
            })()}
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
            {item.prepared && (
              <div className="mt-3 p-3 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Funding Instructions</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-blue-700 dark:text-blue-300">Commit Address</div>
                    <div className="font-mono break-all text-blue-900 dark:text-blue-100">{item.prepared.commitAddress}</div>
                  </div>
                  <div>
                    <div className="text-blue-700 dark:text-blue-300">Required Amount</div>
                    <div className="font-mono text-blue-900 dark:text-blue-100">{item.prepared.requiredCommitAmount} sats ({(item.prepared.requiredCommitAmount / 100000000).toFixed(8)} BTC)</div>
                  </div>
                  <div>
                    <div className="text-blue-700 dark:text-blue-300">Estimated Reveal Fee</div>
                    <div className="font-mono text-blue-900 dark:text-blue-100">{item.prepared.estimatedRevealFee} sats</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-blue-800 dark:text-blue-200">
                  Satpoint selection (optional): choose the exact sat to inscribe on for this item.
                  {satpointsByItem[item.id] && (
                    <div className="mt-1">Selected satpoint: <span className="font-mono">{satpointsByItem[item.id]}</span></div>
                  )}
                </div>
                <div className="mt-2 text-xs text-blue-800 dark:text-blue-200">Send exactly the required amount to the commit address, then enter the commit txid below.</div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(item.prepared!.commitAddress)}>Copy Address</Button>
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(`bitcoin:${item.prepared!.commitAddress}?amount=${(item.prepared!.requiredCommitAmount / 100000000).toFixed(8)}`)}>Copy bitcoin: URI</Button>
                  <Button size="sm" onClick={() => openWalletToPay(item)}>Open Wallet</Button>
                  <Button size="sm" variant="outline" onClick={() => setItemSatpoint(item.id)}>Set Satpoint</Button>
                  <Button size="sm" variant="outline" onClick={() => handleCommitWithSatpoint(item)}>Use Satpoint</Button>
                </div>
              </div>
            )}
            <div className="mt-2 gap-2 hidden">
              <Button size="sm" variant="outline" disabled={actionLoading[item.id]} onClick={() => handlePrepare(item.id)}>Prepare</Button>
              <Button size="sm" variant="outline" disabled={actionLoading[item.id]} onClick={() => handleAcceptCommit(item.id)}>Accept Commit</Button>
              <Button size="sm" variant="outline" disabled={actionLoading[item.id]} onClick={() => handleFinalizeReveal(item.id)}>Finalize Reveal</Button>
            </div>
          </div>
        ))}
        {(!items || items.length === 0) && (
          <div className="p-3 text-sm text-gray-500 dark:text-gray-400">No items to display.</div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" className="px-4 py-2">Back</Button>
        <div className="flex gap-2">
          <div className="hidden md:flex items-center gap-2 mr-2">
            <Button variant="outline" size="sm" onClick={fetchFundingUtxos} disabled={isFetchingUtxos}>
              {isFetchingUtxos ? 'Loading UTXOs…' : 'Refresh UTXOs'}
            </Button>
            <select
              className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1"
              value={selectedFundingUtxo ? `${selectedFundingUtxo.txid}:${selectedFundingUtxo.vout}` : ''}
              onChange={(e) => {
                const val = e.target.value;
                const utxo = availableUtxos.find((u) => `${u.txid}:${u.vout}` === val);
                setSelectedFundingUtxo(utxo || null);
              }}
            >
              <option value="">Auto-select funding UTXOs</option>
              {availableUtxos.map((u) => (
                <option key={`${u.txid}:${u.vout}`} value={`${u.txid}:${u.vout}`}>
                  {u.txid.slice(0,8)}...:{u.vout} • {(u.value/100000000).toFixed(8)} BTC
                </option>
              ))}
            </select>
          </div>
          {hasAnySatpoints ? (
            <Button disabled={isPolling} className="px-4 py-2" onClick={handleRunAllWithSatpoints}>Run Using Satpoints</Button>
          ) : (
            <Button variant="outline" disabled={isPolling} className="px-4 py-2" onClick={handleBuildSignCombinedCommit}>Build & Sign Combined Commit</Button>
          )}
          <Button variant="outline" disabled={isPolling} className="px-4 py-2" onClick={refreshItems}>{isPolling ? 'Refreshing…' : 'Refresh'}</Button>
          <Button disabled={isPolling} className="px-4 py-2">Continue</Button>
        </div>
      </div>
    </div>
  );
};

export default BatchSummaryStep;


