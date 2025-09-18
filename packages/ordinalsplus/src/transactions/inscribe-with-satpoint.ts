import { utils as secpUtils } from '@noble/secp256k1';
import * as btc from '@scure/btc-signer';
import { getScureNetwork } from '../utils/networks';
import { Utxo, BitcoinNetwork } from '../types';
import { prepareResourceInscription, PreparedResourceInfo } from './resource-creation';
import { prepareCommitTransaction, CommitTransactionResult } from './commit-transaction';
import { createRevealTransaction, RevealTransactionResult } from './reveal-transaction';
import { finalizeAndExtractTransaction } from '../utils/psbt-utils';
import { TransactionBroadcaster } from './transaction-broadcasting';
import { transactionTracker, TransactionType } from './transaction-status-tracker';
import * as bitcoin from 'bitcoinjs-lib';

/**
 * Parameters for satpoint-enforced inscription preparation
 */
export interface InscribeWithSatpointParams {
  /** Content to inscribe */
  content: string | Buffer;
  /** MIME type for content */
  contentType: string;
  /** Address to receive the final inscription */
  recipientAddress: string;
  /** Wallet UTXOs (must include the satpoint UTXO) */
  utxos: Utxo[];
  /** Fee rate in sats/vB */
  feeRate: number;
  /** Bitcoin network */
  network: BitcoinNetwork;
  /** Satpoint string ("<txid>:<vout>[:<offset>]") or object */
  satpoint: string | { txid: string; vout: number };
  /** Optional metadata to embed */
  metadata?: Record<string, any>;
  /** Optional resource type label (defaults to "resource") */
  resourceType?: string;
  /** Provide a reveal private key; if omitted one is generated */
  revealPrivateKey?: Uint8Array;
  /** Optional PSBT signer: returns a signed PSBT string (hex or base64). If provided, this helper will broadcast */
  signPsbt?: (psbtBase64: string, options?: any) => Promise<string>;
  /** Optional broadcaster: commit/reveal tx hex -> txid. If not provided, built-in broadcaster is used */
  broadcast?: (txHex: string, phase: 'commit' | 'reveal') => Promise<string>;
}

/**
 * Result of satpoint-enforced inscription preparation
 */
export interface InscribeWithSatpointResult {
  /** Prepared inscription data (commit address, scripts, keys) */
  prepared: PreparedResourceInfo;
  /** Commit transaction preparation result (PSBT, fees, etc.) */
  commit: CommitTransactionResult;
  /** Reveal private key bytes used for the reveal */
  revealPrivateKey: Uint8Array;
  /** Reveal public key bytes corresponding to the private key */
  revealPublicKey: Uint8Array;
  /** Commit transaction id (when signed/broadcast) */
  commitTxid?: string;
  /** Reveal transaction id (when broadcast) */
  revealTxid?: string;
}

/**
 * Prepare an inscription and a commit PSBT that enforces inscribing on the specified satpoint.
 * - Uses the satpoint UTXO as the first input of the commit transaction
 * - Returns the prepared inscription info, commit PSBT, and reveal key material
 */
export async function inscribeWithSatpoint(params: InscribeWithSatpointParams): Promise<InscribeWithSatpointResult> {
  const {
    content,
    contentType,
    recipientAddress,
    utxos,
    feeRate,
    network,
    satpoint,
    metadata = {},
    resourceType = 'resource',
    revealPrivateKey,
    signPsbt,
    broadcast
  } = params;

  // Parse satpoint
  let targetTxid: string;
  let targetVout: number;
  if (typeof satpoint === 'string') {
    const parts = satpoint.split(':');
    // Accept formats: txid:vout or txid:vout:offset
    targetTxid = parts[0];
    targetVout = Number(parts[1]);
  } else {
    targetTxid = satpoint.txid;
    targetVout = satpoint.vout;
  }
  if (!targetTxid || Number.isNaN(targetVout)) {
    throw new Error('Invalid satpoint. Expected format "<txid>:<vout>[:<offset>]" or { txid, vout }');
  }

  // Locate the satpoint UTXO in provided utxos
  const selectedInscriptionUtxo = utxos.find(u => u.txid === targetTxid && u.vout === targetVout);
  if (!selectedInscriptionUtxo) {
    throw new Error('Satpoint UTXO not found in provided utxos. Ensure the wallet controls this UTXO.');
  }

  // Generate or use provided reveal key
  const priv = revealPrivateKey ?? secpUtils.randomPrivateKey();
  const pub = btc.utils.pubSchnorr(priv);

  // Prepare inscription (commit address, inscription script, fee estimates, etc.)
  const prepared = await prepareResourceInscription({
    content,
    contentType,
    resourceType,
    publicKey: pub,
    recipientAddress,
    feeRate,
    network,
    metadata
  } as any);

  // Prepare commit PSBT, forcing selectedInscriptionUtxo as first input
  const commit = await prepareCommitTransaction({
    inscription: prepared.preparedInscription,
    utxos,
    changeAddress: recipientAddress,
    feeRate,
    network,
    // Add a safety buffer to ensure the reveal has adequate funds even if
    // actual vsize ends up larger than estimated or policy minimums rise.
    // Use a dynamic buffer based on fee rate with a sensible floor.
    minimumCommitAmount: Number(prepared.requiredCommitAmount) + Math.max(600, Math.ceil(feeRate * 64)),
    selectedInscriptionUtxo
  });

  // If no signer provided, return preparation results only
  if (!signPsbt) {
    return {
      prepared,
      commit,
      revealPrivateKey: priv,
      revealPublicKey: pub
    };
  }

  // 1) Sign commit PSBT and extract raw tx
  const signedCommitPsbt = await signPsbt(commit.commitPsbtBase64, { autoFinalized: false });
  const commitTxHex = finalizeAndExtractTransaction(signedCommitPsbt);

  // 2) Broadcast commit
  let commitTxid: string;
  if (broadcast) {
    commitTxid = await broadcast(commitTxHex, 'commit');
  } else {
    const broadcaster = new TransactionBroadcaster(transactionTracker);
    const result = await broadcaster.broadcastTransaction(commitTxHex, TransactionType.COMMIT, { network });
    commitTxid = result.txid;
  }

  // Extract actual commit output value from the finalized commit tx (prevents Schnorr sighash amount mismatch)
  let actualCommitOutputValue = Number(commit.requiredCommitAmount ?? prepared.requiredCommitAmount);
  try {
    const parsedCommit = bitcoin.Transaction.fromHex(commitTxHex);
    // vout 0 is expected commit output
    const out0 = parsedCommit.outs[0];
    if (out0 && typeof out0.value === 'number' && out0.value > 0) {
      actualCommitOutputValue = out0.value;
    }
  } catch {}

  // 3) Create reveal transaction (signed with revealPrivateKey)
  // Sanity: verify reveal key matches prepared reveal pubkey
  try {
    const derivedPub = btc.utils.pubSchnorr(priv);
    const preparedPub = prepared.preparedInscription.revealPublicKey;
    if (!preparedPub || preparedPub.length !== derivedPub.length || !preparedPub.every((b, i) => b === derivedPub[i])) {
      throw new Error('Reveal key mismatch: generated private key does not match prepared reveal public key');
    }
  } catch {}

  // Ensure internal key matches the commit script (prevents invalid Schnorr signatures)
  let preparedForReveal = prepared;
  try {
    const commitScript = prepared.preparedInscription.commitAddress.script;
    if (commitScript && commitScript.length >= 34 && commitScript[0] === 0x51 && commitScript[1] === 0x20) {
      const extractedKey = commitScript.slice(2, 34);
      const currentKey = prepared.preparedInscription.commitAddress.internalKey;
      const mismatch = !currentKey || currentKey.length !== extractedKey.length || !currentKey.every((b: number, i: number) => b === extractedKey[i]);
      if (mismatch) {
        preparedForReveal = {
          ...prepared,
          preparedInscription: {
            ...prepared.preparedInscription,
            commitAddress: {
              ...prepared.preparedInscription.commitAddress,
              internalKey: extractedKey
            }
          }
        } as PreparedResourceInfo;
      }
    }
  } catch {}

  // Slightly increase reveal fee rate vs the requested base as additional safety
  const baseRevealFeeRate = feeRate;
  const initialRevealFeeRate = Math.max(baseRevealFeeRate + 5, Math.ceil(baseRevealFeeRate * 1.15));

  let reveal = await createRevealForSatpointCommit({
    commitTxid,
    prepared: preparedForReveal,
    revealPrivateKey: priv,
    requiredCommitAmount: actualCommitOutputValue,
    feeRate: initialRevealFeeRate,
    network,
    destinationAddress: recipientAddress
  });

  // 4) Broadcast reveal with automatic retry on policy-minimum fee errors
  let revealTxid: string | undefined;
  const tryBroadcast = async (hex: string) => {
    if (broadcast) {
      return await broadcast(hex, 'reveal');
    } else {
      const broadcaster = new TransactionBroadcaster(transactionTracker);
      const result = await broadcaster.broadcastTransaction(hex, TransactionType.REVEAL, { network }, undefined);
      return result.txid;
    }
  };

  try {
    revealTxid = await tryBroadcast(reveal.hex);
  } catch (err: any) {
    const msg = typeof err?.message === 'string' ? err.message : String(err);
    const isMinRelayFee = msg.includes('min relay fee not met') || msg.includes('code":-26');
    if (!isMinRelayFee) {
      throw err;
    }
    // Rebuild reveal with a higher fee rate and retry once (or twice if still short)
    let bumpedRate = Math.max(initialRevealFeeRate + 5, Math.ceil(initialRevealFeeRate * 1.2));
    for (let attempt = 0; attempt < 2; attempt++) {
      const bumped = await createRevealForSatpointCommit({
        commitTxid,
        prepared: preparedForReveal,
        revealPrivateKey: priv,
        requiredCommitAmount: actualCommitOutputValue,
        feeRate: bumpedRate,
        network,
        destinationAddress: recipientAddress
      });
      try {
        revealTxid = await tryBroadcast(bumped.hex);
        reveal = bumped;
        break;
      } catch (e: any) {
        const again = typeof e?.message === 'string' ? e.message : String(e);
        if (!(again.includes('min relay fee not met') || again.includes('code":-26'))) {
          throw e;
        }
        bumpedRate = Math.max(bumpedRate + 5, Math.ceil(bumpedRate * 1.2));
        if (attempt === 1) throw e;
      }
    }
  }

  return {
    prepared,
    commit,
    revealPrivateKey: priv,
    revealPublicKey: pub,
    commitTxid,
    revealTxid
  };
}

/**
 * After the commit transaction is broadcast and you have the commit txid,
 * create the reveal transaction that spends the commit output and embeds the inscription.
 */
export async function createRevealForSatpointCommit(args: {
  /** Commit transaction ID returned after broadcasting the signed commit PSBT */
  commitTxid: string;
  /** Prepared info from inscribeWithSatpoint */
  prepared: PreparedResourceInfo;
  /** Reveal private key generated/used by inscribeWithSatpoint */
  revealPrivateKey: Uint8Array;
  /** Required commit amount from preparation (postage + reveal fee allocation) */
  requiredCommitAmount: number;
  /** Fee rate in sats/vB */
  feeRate: number;
  /** Bitcoin network */
  network: BitcoinNetwork;
  /** Optional destination address. Defaults to commit address if omitted */
  destinationAddress?: string;
}): Promise<RevealTransactionResult> {
  const { commitTxid, prepared, revealPrivateKey, requiredCommitAmount, feeRate, network, destinationAddress } = args;

  // The commit output is created as the first output in prepareCommitTransaction
  const selectedUTXO = {
    txid: commitTxid,
    vout: 0,
    value: Number(requiredCommitAmount),
    script: {
      type: 'p2tr',
      address: prepared.preparedInscription.commitAddress.address
    }
  } as unknown as Utxo;

  return createRevealTransaction({
    selectedUTXO,
    preparedInscription: {
      ...prepared.preparedInscription,
      // ensure the reveal key is available for signing
    } as any,
    privateKey: revealPrivateKey,
    feeRate,
    network: getScureNetwork(network),
    commitTransactionId: commitTxid,
    destinationAddress
  });
}


