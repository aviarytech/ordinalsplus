import React, { useState } from 'react';
import { Button } from '../ui';
import { useApi } from '../../context/ApiContext';
import { useWallet } from '../../context/WalletContext';
import {
  prepareBatchInscription,
  prepareMultiInscriptionCommitTransaction,
  estimateRequiredCommitAmountForBatch,
  finalizeAndExtractTransaction,
  createRevealTransaction,
  getScureNetwork
} from 'ordinalsplus';
// Explorer should not talk directly to ord nodes; rely on backend ApiService only

interface BatchPackageState {
  manifestNetwork?: string;
  selections: any[];
  files: Array<{ name: string; path?: string; file: File }>;
  manifest: any;
}

interface Props { onNext: () => void; onBack: () => void; pkg?: BatchPackageState; onResults: (items: any[]) => void }

const BatchRunStep: React.FC<Props> = ({ onNext, onBack, pkg, onResults }) => {
  const { apiService } = useApi();
  const { address, getUtxos, signPsbt, network: walletNetwork } = useWallet();
  const [running, setRunning] = useState(false);
  const [feeRateInput, setFeeRateInput] = useState<string>('');
  const [log, setLog] = useState<string[]>([]);
  const [awaitingRevealConfirm, setAwaitingRevealConfirm] = useState(false);
  const [revealPreviewItems, setRevealPreviewItems] = useState<Array<{ index: number; label: string; contentType: string; bytes: number; sat?: number }>>([]);
  const [preparedBatchRef, setPreparedBatchRef] = useState<any | null>(null);
  const [commitPrepRef, setCommitPrepRef] = useState<any | null>(null);
  const [commitTxidRef, setCommitTxidRef] = useState<string | undefined>(undefined);
  const [commitHexRef, setCommitHexRef] = useState<string | null>(null);
  const [activeNetworkRef, setActiveNetworkRef] = useState<any | null>(null);
  const [feeRateRef, setFeeRateRef] = useState<number | null>(null);
  const [vcIssues, setVcIssues] = useState<Array<{ index: number; label: string; expected: string; found?: string; parsed?: string }>>([]);

  // Human-readable formatter for bytes
  const formatBytes = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    const decimals = n < 10 && i > 0 ? 2 : 0;
    return `${n.toFixed(decimals)} ${units[i]}`;
  };

  const totalBytes = React.useMemo(() => revealPreviewItems.reduce((sum, it) => sum + (it.bytes || 0), 0), [revealPreviewItems]);

  const append = (s: string) => setLog(prev => [...prev, s]);
  const rebuildWithFee = async (f: number) => {
    setFeeRateInput(String(f));
    setAwaitingRevealConfirm(false);
    setRunning(false);
    setTimeout(() => { runLocalMultiInscription(); }, 0);
  };

  const runLocalMultiInscription = async () => {
    if (!pkg?.manifest?.files?.length) { append('No manifest loaded'); return; }
    if (!address || !getUtxos || !signPsbt) { append('Connect a wallet first'); return; }
    setRunning(true);
    try {
      const activeNetwork = (pkg?.manifest?.network || (walletNetwork === 'mainnet' ? 'mainnet' : (walletNetwork === 'signet' ? 'signet' : 'testnet'))) as any;
      setActiveNetworkRef(activeNetwork);
      append(`Using wallet network: ${activeNetwork}`);

      // Build target entry list from manifest + auto-discovered files
      const findFileBlob = (target: string): File | undefined => {
        // direct match by path or name
        let fileEntry = pkg!.files.find(f => f.path === target || f.name === target);
        if (fileEntry) return fileEntry.file;
        // suffix match on path (webkitRelativePath)
        fileEntry = pkg!.files.find(f => f.path?.endsWith(`/${target}`));
        if (fileEntry) return fileEntry.file;
        // case-insensitive match by name
        const lower = target.toLowerCase();
        fileEntry = pkg!.files.find(f => f.name.toLowerCase() === lower || f.path?.toLowerCase().endsWith(`/${lower}`));
        return fileEntry?.file;
      };

      // Start with manifest entries if present
      const manifestEntries = Array.isArray(pkg.manifest.files) ? (pkg.manifest.files as Array<{ file: string; contentType?: string; metadata?: string }>) : [];

      // Use only manifest-listed files (no auto-discovery)
      const allEntries: Array<{ file: string; contentType?: string; metadata?: string }>
        = manifestEntries;

      // Dedupe by normalized key (prefer first occurrence)
      const seen = new Set<string>();
      const dedupedEntries = allEntries.filter(e => {
        const key = (e.file || '').toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const contents = [] as Array<{ contentType: string; content: Uint8Array; metadata?: Record<string, string>; label: string; metadataPath?: string }>;
      for (const entry of dedupedEntries) {
        const blob = findFileBlob(entry.file);
        if (!blob) { append(`Missing file: ${entry.file}`); continue; }
        const buf = new Uint8Array(await blob.arrayBuffer());
        let metadata: Record<string, any> | undefined;
        let metadataPathUsed: string | undefined;
        const tryAttachMetadata = async (pathLike?: string) => {
          if (!pathLike) return;
          let tried: string[] = [];
          const tryOne = async (p: string) => {
            tried.push(p);
            const vcBlob = findFileBlob(p);
            if (vcBlob) {
              try { metadata = JSON.parse(await vcBlob.text()); metadataPathUsed = p; return true; } catch { /* ignore parse error */ }
            }
            return false;
          };
          // try as provided
          if (await tryOne(pathLike)) return;
          // try basename only
          const base = pathLike.split('/').pop() || pathLike;
          if (base !== pathLike && await tryOne(base)) return;
          // try case-insensitive handled by findFileBlob
          await tryOne(base.toLowerCase());
        }
        // Attach metadata if provided by manifest
        if (entry.metadata) {
          await tryAttachMetadata(String(entry.metadata).trim());
        }
        // If no metadata path provided, try to auto-pair <file>.vc.json
        if (!metadata) {
          const base = entry.file.replace(/\.[^.]+$/, '');
          await tryAttachMetadata(`${base}.vc.json`);
        }
        contents.push({ contentType: entry.contentType || 'application/octet-stream', content: buf, metadata, label: entry.file, metadataPath: metadataPathUsed });
      }
      if (!contents.length) { append('No valid inputs for multi-inscription'); return; }
      // Log metadata attachment summary per file for debugging
      contents.forEach(c => {
        append(`Metadata ${c.metadata ? 'attached' : 'missing'} → file: ${c.label} • path: ${c.metadataPath || '(auto/none)'}`);
      });

      // Resolve sat ranges for funding UTXO via backend only
      let satNumbers: number[] | undefined;
      const fundingUtxo = (pkg.manifest as any)?.fundingUtxo as string | undefined; // format txid:vout
      // Use postage from manifest if provided, otherwise default to 551 sats
      const postageSats = BigInt((pkg.manifest as any)?.postage || 551);
      if (fundingUtxo && apiService) {
        try {
          const start = await apiService.getSatNumber(activeNetwork, fundingUtxo);
          if (typeof start === 'number') {
            satNumbers = contents.map((_, i) => start! + Number(postageSats) * i);
            append(`Resolved sat numbers: ${satNumbers.join(', ')}`);
          }
        } catch (e:any) {
          append(`Failed to resolve sat numbers (backend): ${e?.message || String(e)}`);
        }
      }

      // Sanity check: VC credentialSubject.id must contain the sat number being inscribed
      if (!satNumbers || satNumbers.length !== contents.length) {
        append(`Sanity check aborted: could not compute sat numbers for all files.
 - fundingUtxo: ${(pkg.manifest as any)?.fundingUtxo || '(none)'}
 - files in batch: ${contents.length}
 - sats resolved: ${satNumbers ? satNumbers.length : 0}`);
        setRunning(false);
        return;
      }

      // Robust ID extractor for varied VC shapes
      const extractCredentialSubjectId = (meta: any): { id?: string; path?: string } => {
        if (!meta || typeof meta !== 'object') return {};
        const pickFrom = (cs: any): string | undefined => {
          if (!cs) return undefined;
          if (typeof cs === 'string') return cs;
          if (Array.isArray(cs)) {
            for (const el of cs) { const v = pickFrom(el); if (v) return v; }
            return undefined;
          }
          return cs.id || cs['@id'] || undefined;
        };
        const direct = pickFrom(meta.credentialSubject); if (direct) return { id: String(direct), path: 'credentialSubject' };
        const vcCs = pickFrom(meta.vc?.credentialSubject); if (vcCs) return { id: String(vcCs), path: 'vc.credentialSubject' };
        const vcredCs = pickFrom(meta.verifiableCredential?.credentialSubject); if (vcredCs) return { id: String(vcredCs), path: 'verifiableCredential.credentialSubject' };
        const stack: Array<{ node: any; p: string }> = [{ node: meta, p: '' }];
        while (stack.length) {
          const { node, p } = stack.pop()!;
          if (node && typeof node === 'object') {
            for (const k of Object.keys(node)) {
              const child = node[k]; const np = p ? `${p}.${k}` : k;
              if (k === 'credentialSubject') { const v = pickFrom(child); if (v) return { id: String(v), path: np }; }
              if (child && typeof child === 'object') stack.push({ node: child, p: np });
            }
          }
        }
        return {};
      };

      for (let i = 0; i < contents.length; i++) {
        const c = contents[i];
        const meta = c.metadata as any;
        const { id: extractedId, path: idPath } = extractCredentialSubjectId(meta);
        const idStr = extractedId ? String(extractedId) : '';
        const expected = String(satNumbers[i]);
        // Prefer the longest numeric sequence in the id (handles suffixes like "/0")
        const allNums = idStr.match(/\d+/g) || [];
        let parsedSat = undefined as string | undefined;
        if (allNums.length) {
          parsedSat = allNums.reduce((best, cur) => (cur.length > (best?.length || 0) ? cur : best), undefined as string | undefined);
        }
        if (!idStr || !idStr.includes(expected)) {
          append(`VC MISMATCH → file: ${c.label}
 - computed sat (to be inscribed): ${expected}
 - metadata path: ${c.metadataPath || '(unknown)'}
 - credentialSubject.id: ${idStr || '(missing)'} (found at: ${idPath || 'n/a'})
 - parsed sat from id: ${parsedSat || '(none)'}
Resolution: Ensure the generator writes the sat number ${expected} into credentialSubject.id (e.g., include it as a plain number or within the DID/URL).`);
          // Record mismatch but continue to allow preview & commit building
          // We'll disable confirmation until issues are resolved
          // Collect later to display in preview
          setVcIssues(prev => [...prev, { index: i, label: c.label, expected, found: idStr || undefined, parsed: parsedSat }]);
          continue;
        } else {
          append(`VC MATCH → file: ${c.label} • computed sat: ${expected} • credentialSubject.id: ${idStr} (path: ${idPath || 'n/a'}) • parsed: ${parsedSat || '(none)'});
`);
        }
      }

      // Note: ord-node availability checks are handled server-side; explorer does not call ord

      // If sat numbers known and content is textual, replace placeholders
      const encodeUtf8 = (s: string) => new TextEncoder().encode(s);
      const isTextual = (ct: string) => ct.startsWith('text/') || ct === 'application/json' || ct.includes('charset');
      const preparedContents = contents.map((c, i) => {
        let payload = c.content;
        if (satNumbers && isTextual(c.contentType)) {
          try {
            const text = new TextDecoder().decode(c.content);
            const replaced = text.includes('{{SAT_NUMBER}}') ? text.replace(/\{\{SAT_NUMBER\}\}/g, String(satNumbers![i])) : text;
            payload = encodeUtf8(replaced);
          } catch {}
        }
        // Ensure separate sats via pointer tags
        const pointer = postageSats * BigInt(i);
        // Pass metadata exactly as provided in the .vc.json without injecting additional properties
        return { contentType: c.contentType, content: payload, metadata: c.metadata, pointer } as any;
      });

      // Helper to estimate reveal vsize from contents (matches core logic)
      const estimateRevealVsize = (items: Array<{ content: Uint8Array }>) => {
        const totalBytes = items.reduce((sum, it) => sum + Number(it.content?.byteLength || it.content?.length || 0), 0);
        return Math.ceil(100 + (totalBytes * 0.27));
      };

      // Build UTXO set and funding selection once; reused for chunks
      const utxos = await getUtxos();
      const isInscriptionUtxoHeuristic = (u: any) => {
        return !!(
          (Array.isArray(u?.inscriptions) && u.inscriptions.length > 0) ||
          u?.inscriptionId || u?.containsInscription || u?.isInscription ||
          u?.isOrdinal || u?.ordinal || u?.hasInscription
        );
      };
      const cleanUtxos = (utxos || []).filter((u: any) => !isInscriptionUtxoHeuristic(u));
      append(`Filtered UTXOs (clean): ${cleanUtxos.map((u:any)=>`${u.txid.slice(0,8)}...:${u.vout}`).join(', ') || '(none)'}`);

      let selectedFunding: any | undefined;
      const manifestFundingUtxo = (pkg.manifest as any)?.fundingUtxo as string | undefined; // txid:vout
      if (manifestFundingUtxo) {
        try {
          const [fTxid, fVoutStr] = manifestFundingUtxo.split(':');
          const fVout = Number(fVoutStr);
          if (fTxid && !Number.isNaN(fVout)) {
            selectedFunding = (utxos || []).find((u: any) => u.txid === fTxid && u.vout === fVout);
            if (!selectedFunding) {
              append(`Funding UTXO ${manifestFundingUtxo} not found in wallet UTXOs`);
              return;
            }
            if (isInscriptionUtxoHeuristic(selectedFunding)) {
              append(`Funding UTXO ${manifestFundingUtxo} appears to contain an inscription. Refusing to spend it.`);
              append('Choose a different funding UTXO or remove inscriptions from that UTXO.');
              return;
            }
          }
        } catch {}
      }

      const parsedFee = (() => {
        const raw = (feeRateInput || '').trim();
        if (!raw) return undefined;
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? n : undefined;
      })();
      const feeRate = (parsedFee !== undefined ? parsedFee : (activeNetwork === 'signet' ? 1 : 10));
      setFeeRateRef(feeRate);
      append(`Using fee rate: ${feeRate} sat/vB`);
      try {
        if (pkg && pkg.manifest) { (pkg.manifest as any).feeRate = feeRate; }
        try { localStorage.setItem('ordinalsplus_batch_fee_rate', String(feeRate)); } catch {}
      } catch {}

      // Decide if we need to split this batch by measured reveal vsize using a dry-run build
      // More conservative cap to avoid policy rejections
      const MAX_REVEAL_VSIZE = 80000; // target well under ~100k vB
      // Helper: measure reveal vsize by building a signed tx (dry-run) with a simulated input
      const measureRevealVsize = async (prepared: any): Promise<number> => {
        try {
          const baseRequired = estimateRequiredCommitAmountForBatch(prepared as any, feeRate, Number(postageSats));
          const simulated = await createRevealTransaction({
            selectedUTXO: { txid: '0'.repeat(64), vout: 0, value: baseRequired, script: { type: 'p2tr', address: (prepared as any).commitAddress.address } } as any,
            preparedInscription: prepared as any,
            feeRate,
            network: getScureNetwork(activeNetwork),
            privateKey: (prepared as any).revealPrivateKey,
            destinationAddress: address || undefined
          });
          return simulated.vsize;
        } catch (e) {
          // Fallback to heuristic if dry-run fails
          return estimateRevealVsize(((prepared as any)?.inscriptions || []).map((i: any) => ({ content: i?.body || new Uint8Array() })) as any);
        }
      };

      // Prepare full batch once for sizing decision (pointer offsets preserved as earlier)
      const preparedBatchAll = prepareBatchInscription({ contents: preparedContents as any, network: activeNetwork });
      const measuredAllVsize = await measureRevealVsize(preparedBatchAll as any);
      const needsSplit = measuredAllVsize > MAX_REVEAL_VSIZE;

      // Function to build candidate utxos to reach target minimum commit amount
      const buildCandidates = (targetAmount: number) => {
        let candidate: any[] = [];
        if (selectedFunding) candidate.push(selectedFunding);
        const extras = cleanUtxos.filter((u: any) => !selectedFunding || !(u.txid === selectedFunding.txid && u.vout === selectedFunding.vout));
        let sum = selectedFunding ? selectedFunding.value : 0;
        for (const u of extras) {
          if (sum >= targetAmount) break;
          candidate.push(u);
          sum += u.value;
        }
        return { candidate, sum };
      };

      if (!needsSplit) {
        // Single-transaction path (current behavior)
        const preparedBatch = prepareBatchInscription({ contents: preparedContents as any, network: activeNetwork });
        setPreparedBatchRef(preparedBatch as any);
        append(`Prepared multi-inscription commit address: ${preparedBatch.commitAddress.address}`);

        // Use measured reveal vsize for precise fee requirement (handles mixed-size outputs)
        const measuredV = await measureRevealVsize(preparedBatch as any);
        const outputsCount = Array.isArray((preparedBatch as any)?.inscriptions) ? (preparedBatch as any).inscriptions.length : 1;
        const postageTotal = Number(postageSats) * outputsCount;
        const bufferVBytes = 64 + Math.max(0, outputsCount - 1) * 8; // match core buffer logic
        const bufferFee = Math.ceil(feeRate * bufferVBytes);
        const measuredRequired = postageTotal + Math.ceil(measuredV * feeRate) + bufferFee;
        const baseRequired = estimateRequiredCommitAmountForBatch(preparedBatch as any, feeRate, Number(postageSats));
        const effectiveRequired = Math.max(baseRequired, measuredRequired);
        const safetyMultiplier = 1.25;
        const extraMargin = Math.max(20000, Math.ceil(feeRate * (256 + 64 * outputsCount)));
        const minimumCommitAmount = Math.ceil(effectiveRequired * safetyMultiplier) + extraMargin;
        append(`Aggressive funding → base: ${baseRequired} • x${safetyMultiplier} + extra: ${extraMargin} = min: ${minimumCommitAmount}`);

        const { candidate: candidateUtxos, sum } = buildCandidates(minimumCommitAmount);
        if (sum < minimumCommitAmount) {
          append(`Insufficient clean UTXOs: need ${minimumCommitAmount} sats, have ${sum} sats.`);
          append('Add more non-inscription UTXOs to wallet or reduce postage/fee/inscriptions.');
          setRunning(false);
          return;
        }

        const commitPrep = await prepareMultiInscriptionCommitTransaction({
          prepared: preparedBatch as any,
          utxos: candidateUtxos as any,
          changeAddress: address!,
          feeRate,
          network: activeNetwork,
          selectedInscriptionUtxo: selectedFunding || undefined,
          minimumCommitAmount,
          postagePerInscription: Number(postageSats)
        });
        append('Commit PSBT prepared');

        const signedPsbtHex = await signPsbt(commitPrep.commitPsbtBase64);
        const commitHex = finalizeAndExtractTransaction(signedPsbtHex);
        setCommitHexRef(commitHex as string);

        const resultLabels = Array.isArray(pkg?.manifest?.files) ? (pkg!.manifest!.files as Array<{ file: string }>).
          map(e => e.file) : [];
        const count = Array.isArray((preparedBatch as any)?.inscriptions) ? (preparedBatch as any).inscriptions.length : 1;
        const preview: Array<{ index: number; label: string; contentType: string; bytes: number; sat?: number }> = [];
        for (let i = 0; i < count; i++) {
          const src: any = (preparedContents as any)[i];
          const label = resultLabels[i] || src?.label || `Item ${i+1}`;
          preview.push({
            index: i,
            label,
            contentType: src?.contentType || 'application/octet-stream',
            bytes: Number(src?.content?.byteLength || src?.content?.length || 0),
            sat: Array.isArray(satNumbers) ? (satNumbers as number[])[i] : undefined
          });
        }
        setCommitPrepRef(commitPrep as any);
        setRevealPreviewItems(preview);
        setAwaitingRevealConfirm(true);
        setRunning(false);
        return;
      }

      // Split into multiple chunks keeping each measured reveal under MAX_REVEAL_VSIZE
      append(`Batch is large (measured ~${measuredAllVsize} vB). Splitting into multiple transactions…`);
      const chunks: Array<Array<any>> = [];
      let start = 0;
      while (start < (preparedContents as any).length) {
        let end = Math.min((preparedContents as any).length, start + 1);
        let bestEnd = end;
        // Grow this chunk while under the threshold
        while (end <= (preparedContents as any).length) {
          const slice = (preparedContents as any).slice(start, end).map((c: any, idx: number) => ({ ...c, pointer: postageSats * BigInt(idx) }));
          const preparedChunk = prepareBatchInscription({ contents: slice as any, network: activeNetwork });
          const vsize = await measureRevealVsize(preparedChunk as any);
          if (vsize <= MAX_REVEAL_VSIZE) {
            bestEnd = end;
            end += 1;
          } else {
            break;
          }
        }
        // Ensure at least one item per chunk
        const finalSlice = (preparedContents as any).slice(start, Math.max(bestEnd, start + 1));
        chunks.push(finalSlice);
        start = Math.max(bestEnd, start + 1);
      }
      append(`Created ${chunks.length} sub-batch(es).`);

      const allResults: any[] = [];
      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        const estV = estimateRevealVsize(chunk as any);
        append(`Sub-batch ${ci+1}/${chunks.length}: ${chunk.length} item(s), est. ${estV} vB`);

        // Reset pointer within each chunk to ensure proper separation
        const chunkPrepared = chunk.map((c: any, idx: number) => ({ ...c, pointer: postageSats * BigInt(idx) }));
        const preparedBatchChunk = prepareBatchInscription({ contents: chunkPrepared as any, network: activeNetwork });

        // Mixed-size friendly funding using measured vsize per chunk
        const measuredV = await measureRevealVsize(preparedBatchChunk as any);
        const outputsCount = Array.isArray((preparedBatchChunk as any)?.inscriptions) ? (preparedBatchChunk as any).inscriptions.length : 1;
        const postageTotal = Number(postageSats) * outputsCount;
        const bufferVBytes = 64 + Math.max(0, outputsCount - 1) * 8;
        const bufferFee = Math.ceil(feeRate * bufferVBytes);
        const measuredRequired = postageTotal + Math.ceil(measuredV * feeRate) + bufferFee;
        const baseRequired = estimateRequiredCommitAmountForBatch(preparedBatchChunk as any, feeRate, Number(postageSats));
        const effectiveRequired = Math.max(baseRequired, measuredRequired);
        const safetyMultiplier = 1.25;
        const extraMargin = Math.max(20000, Math.ceil(feeRate * (256 + 64 * outputsCount)));
        const minimumCommitAmount = Math.ceil(effectiveRequired * safetyMultiplier) + extraMargin;
        const { candidate: candidateUtxos, sum } = buildCandidates(minimumCommitAmount);
        if (sum < minimumCommitAmount) {
          append(`Sub-batch ${ci+1}: insufficient funds (need ${minimumCommitAmount}, have ${sum}). Aborting.`);
          setRunning(false);
          return;
        }

        const commitPrep = await prepareMultiInscriptionCommitTransaction({
          prepared: preparedBatchChunk as any,
          utxos: candidateUtxos as any,
          changeAddress: address!,
          feeRate,
          network: activeNetwork,
          selectedInscriptionUtxo: ci === 0 ? (selectedFunding || undefined) : undefined,
          minimumCommitAmount,
          postagePerInscription: Number(postageSats)
        });
        append(`Sub-batch ${ci+1}: commit PSBT prepared`);

        const signedPsbtHex = await signPsbt(commitPrep.commitPsbtBase64);
        const commitHex = finalizeAndExtractTransaction(signedPsbtHex);
        const commitResp = await apiService?.broadcastTransaction(activeNetwork, commitHex as string);
        const commitTxid = (commitResp as any)?.txid || commitResp;
        append(`Sub-batch ${ci+1}: commit broadcasted ${commitTxid}`);

        const reveal = await createRevealTransaction({
          selectedUTXO: { txid: commitTxid as string, vout: 0, value: (commitPrep as any).commitOutputValue, script: { type: 'p2tr', address: (preparedBatchChunk as any).commitAddress.address } } as any,
          preparedInscription: preparedBatchChunk as any,
          feeRate,
          network: getScureNetwork(activeNetwork),
          privateKey: (preparedBatchChunk as any).revealPrivateKey,
          destinationAddress: address || undefined
        });
        const revealResp = await apiService?.broadcastTransaction(activeNetwork, reveal.hex);
        const revealTxid = (revealResp as any)?.txid || revealResp;
        append(`Sub-batch ${ci+1}: reveal broadcasted ${revealTxid}`);

        // Collect results for this chunk
        const resultLabels = Array.isArray(pkg?.manifest?.files) ? (pkg!.manifest!.files as Array<{ file: string }>).
          map(e => e.file) : [];
        const startIndex = chunks.slice(0, ci).reduce((acc, arr) => acc + arr.length, 0);
        for (let i = 0; i < chunk.length; i++) {
          const globalIndex = startIndex + i;
          const src: any = (preparedContents as any)[globalIndex];
          const label = resultLabels[globalIndex] || src?.label || `Item ${globalIndex+1}`;
          allResults.push({
            id: `${commitTxid}:${i}`,
            label,
            status: 'completed',
            inscriptionId: revealTxid,
            transactions: { commit: commitTxid, reveal: revealTxid }
          });
        }
      }

      onResults(allResults as any);
      setAwaitingRevealConfirm(false);
      onNext();
      setRunning(false);
      return;
    } catch (e: any) {
      append(`Error in local multi-inscription: ${e?.message || String(e)}`);
    } finally {
      setRunning(false);
    }
  };

  const confirmAndBroadcastReveal = async () => {
    if (!preparedBatchRef || !commitPrepRef || !commitHexRef || !activeNetworkRef) return;
    setRunning(true);
    try {
      // 1) Broadcast commit
      let commitTxidLocal = commitTxidRef;
      if (!commitTxidLocal) {
        const commitResp = await apiService?.broadcastTransaction(activeNetworkRef, commitHexRef as string);
        commitTxidLocal = (commitResp as any)?.txid || commitResp;
        setCommitTxidRef(commitTxidLocal as string);
        append(`Commit broadcasted: ${commitTxidLocal}`);
      }

      // 2) Build reveal transaction and broadcast
      let revealTxid: string | undefined;
      const revealBuild = async (rate: number) => {
        return await createRevealTransaction({
          selectedUTXO: { txid: commitTxidLocal as string, vout: 0, value: (commitPrepRef as any).commitOutputValue, script: { type: 'p2tr', address: (preparedBatchRef as any).commitAddress.address } } as any,
          preparedInscription: preparedBatchRef as any,
          feeRate: rate,
          network: getScureNetwork(activeNetworkRef),
          privateKey: (preparedBatchRef as any).revealPrivateKey,
          destinationAddress: address || undefined
        });
      };

      try {
        const reveal = await revealBuild(feeRateRef || 1);
        const revealResp = await apiService?.broadcastTransaction(activeNetworkRef, reveal.hex);
        revealTxid = (revealResp as any)?.txid || revealResp;
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (msg.includes('insufficient fee') && msg.includes('rejecting replacement')) {
          const bumped = await revealBuild(Math.max((feeRateRef || 1) + 1, Math.ceil((feeRateRef || 1) + 1)));
          const resp2 = await apiService?.broadcastTransaction(activeNetworkRef, bumped.hex);
          revealTxid = (resp2 as any)?.txid || resp2;
        } else {
          throw e;
        }
      }
      append(`Reveal broadcasted: ${revealTxid}`);

      const resultLabels = Array.isArray(pkg?.manifest?.files) ? (pkg!.manifest!.files as Array<{ file: string }>).map(e => e.file) : [];
      const results = (resultLabels.length ? resultLabels : ['Batch']).map((lbl: string, idx: number) => ({
        id: `${commitTxidLocal}:${idx}`,
        label: lbl,
        status: 'completed',
        inscriptionId: revealTxid,
        transactions: { commit: commitTxidLocal, reveal: revealTxid }
      }));
      onResults(results as any);
      setAwaitingRevealConfirm(false);
      onNext();
    } catch (e: any) {
      append(`Error broadcasting reveal: ${e?.message || String(e)}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 dark:text-gray-300">Prepare to run batch inscription using the real PSBT flow.</div>
      <div className="flex items-end gap-2">
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Fee rate (sat/vB)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="e.g. 0.51"
            value={feeRateInput}
            onChange={(e)=> setFeeRateInput(e.target.value)}
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
          />
        </div>
        <div className="pb-1">
          <Button variant="outline" onClick={() => setFeeRateInput('1.51')} disabled={running}>
            Set 1.51
          </Button>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 pb-1">
          Decimals supported. This target will be used for commit and reveal.
        </div>
      </div>
      <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs h-40 overflow-auto border border-gray-200 dark:border-gray-700">
        {log.map((l,i)=>(<div key={i}>{l}</div>))}
      </div>
      {awaitingRevealConfirm && (
        <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded p-3 space-y-2">
          <div className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">Review reveal outputs (in order)</div>
          <div className="text-xs text-yellow-800 dark:text-yellow-200">You are about to broadcast the reveal transaction. Verify each inscription maps to the intended output index.</div>
          <div className="text-xs text-yellow-900 dark:text-yellow-100 mt-1">
            {revealPreviewItems.length} file{revealPreviewItems.length!==1?'s':''} • Total size: {formatBytes(totalBytes)} ({totalBytes} bytes)
          </div>

          {/* Visual diagram: input → outputs */}
          <div className="mt-2 bg-white/60 dark:bg-gray-800/60 rounded p-3 border border-yellow-200/60 dark:border-yellow-700/60">
            <div className="grid grid-cols-12 gap-2 items-center">
              {/* Input box */}
              <div className="col-span-5">
                <div className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Input (Reveal)</div>
                  <div className="text-xs font-mono break-all text-gray-800 dark:text-gray-100">
                    {commitTxidRef ? `${String(commitTxidRef).slice(0, 12)}…:0` : 'commitTxid:0'}
                  </div>
                  <div className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                    Value: {(commitPrepRef as any)?.commitOutputValue ? `${(commitPrepRef as any).commitOutputValue} sats` : 'unknown'}
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="col-span-2 flex justify-center">
                <div className="text-gray-600 dark:text-gray-300">→</div>
              </div>

              {/* Outputs stack */}
              <div className="col-span-5">
                <div className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Outputs</div>
                  <div className="space-y-2 max-h-40 overflow-auto pr-1">
                    {revealPreviewItems.map((it) => (
                      <div key={`viz-${it.index}`} className="flex items-center gap-2">
                        <div className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600">
                          #{it.index}
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-mono break-all text-gray-800 dark:text-gray-100">{it.label}</div>
                          <div className="text-[11px] text-gray-600 dark:text-gray-300">
                            {(pkg?.manifest?.postage ?? 551) as number} sats{it.sat !== undefined ? ` • sat ${it.sat}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="max-h-48 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-700 dark:text-gray-200">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">File</th>
                  <th className="py-1 pr-2">Content-Type</th>
                  <th className="py-1 pr-2">Size</th>
                  <th className="py-1 pr-2">Sat</th>
                </tr>
              </thead>
              <tbody>
                {revealPreviewItems.map((it) => (
                  <tr key={it.index} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="py-1 pr-2">{it.index}</td>
                    <td className="py-1 pr-2 font-mono break-all">{it.label}</td>
                    <td className="py-1 pr-2">{it.contentType}</td>
                    <td className="py-1 pr-2">{formatBytes(it.bytes)} ({it.bytes})</td>
                    <td className="py-1 pr-2">{it.sat !== undefined ? it.sat : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {vcIssues.length > 0 && (
            <div className="mt-2 rounded border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/40 text-red-800 dark:text-red-100 p-2 text-xs">
              <div className="font-semibold mb-1">{vcIssues.length} VC mismatch{vcIssues.length>1?'es':''} detected</div>
              <ul className="list-disc ml-5 space-y-1">
                {vcIssues.map(v => (
                  <li key={`vci-${v.index}`}>#{v.index} {v.label}: expected {v.expected}{v.parsed?`, parsed ${v.parsed}`:''}{v.found?`, id "${v.found}"`:''}</li>
                ))}
              </ul>
              <div className="mt-1">Fix the VC files so credentialSubject.id contains the expected sat value(s), then retry.</div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setAwaitingRevealConfirm(false); }} disabled={running}>Cancel</Button>
            <Button variant="outline" onClick={() => rebuildWithFee(1.51)} disabled={running}>Rebuild at 1.51</Button>
            <Button onClick={confirmAndBroadcastReveal} disabled={running || vcIssues.length>0 || !commitHexRef}>{running ? 'Broadcasting…' : (vcIssues.length>0 ? 'Fix VC mismatches' : 'Confirm & Broadcast Reveal')}</Button>
          </div>
        </div>
      )}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={running}>Back</Button>
        <div className="flex gap-2">
          <Button onClick={runLocalMultiInscription} disabled={running || awaitingRevealConfirm}>{running ? 'Running…' : 'Start'}</Button>
        </div>
      </div>
    </div>
  );
};

export default BatchRunStep;


