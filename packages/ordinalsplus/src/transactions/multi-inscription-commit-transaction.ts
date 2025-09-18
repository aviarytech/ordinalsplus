import * as btc from '@scure/btc-signer';
import { PreparedBatchInscription } from '../inscription/scripts/ordinal-reveal';
import { Utxo, BitcoinNetwork } from '../types';
import { getScureNetwork } from '../utils/networks';
import { calculateFee } from './fee-calculation';

const MIN_DUST_LIMIT = 546;

export interface MultiInscriptionCommitParams {
  prepared: PreparedBatchInscription;
  utxos: Utxo[];
  changeAddress: string;
  feeRate: number; // sats/vB
  network: BitcoinNetwork;
  /** Optional: override the commit amount. If omitted, it's estimated from content size and fee rate. */
  minimumCommitAmount?: number;
  /** Optional: force a specific first input */
  selectedInscriptionUtxo?: Utxo;
  /** Optional: postage per inscription (defaults to 551 sats if omitted) */
  postagePerInscription?: number;
}

export interface MultiInscriptionCommitResult {
  commitPsbtBase64: string;
  commitPsbt: btc.Transaction;
  selectedUtxos: Utxo[];
  commitOutputValue: number;
  fees: { commit: number };
}

function estimateRevealVSize(totalContentBytes: number, outputsCount: number): number {
  if (totalContentBytes <= 0) return 200; // fallback
  // Base empirical size + per-output overhead (~43 vB for P2TR outputs)
  const perOutputOverhead = 43;
  const additionalOutputs = Math.max(0, (outputsCount || 1) - 1);
  return Math.ceil(100 + (totalContentBytes * 0.27) + (additionalOutputs * perOutputOverhead));
}

export function estimateRequiredCommitAmountForBatch(
  prepared: PreparedBatchInscription,
  feeRate: number,
  postagePerInscription?: number
): number {
  const outputsCount = Array.isArray(prepared.inscriptions) ? prepared.inscriptions.length : 1;
  const totalBytes = prepared.inscriptions.reduce((sum, ins) => sum + (ins.body?.length || 0), 0);
  const vsize = estimateRevealVSize(totalBytes, outputsCount);
  const fee = Number(calculateFee(vsize, feeRate));
  // Add a buffer that scales slightly with number of outputs to account for script variance
  const bufferVBytes = 64 + Math.max(0, outputsCount - 1) * 8; // ~64 vB base + ~8 vB per extra output
  const buffer = Math.ceil(feeRate * bufferVBytes);
  // Require postage per inscription (e.g., 551 sats each) to ensure pointer-separated sats exist in the input
  const ppi = Math.max(typeof postagePerInscription === 'number' ? postagePerInscription : 551, MIN_DUST_LIMIT);
  const totalPostage = ppi * outputsCount;
  return totalPostage + fee + buffer;
}

function estimateCommitTxSize(inputCount: number, includeChange: boolean): number {
  // Rough vsize estimate similar to batch commit: overhead ~10.5 vB
  // Assume P2WPKH (or similar) for inputs ~68 vB each; P2TR output ~43 vB; change P2WPKH ~31 vB
  const overhead = 10.5;
  const inputSize = 68 * inputCount;
  const outputsSize = 43 /* commit P2TR */ + (includeChange ? 31 : 0);
  return Math.ceil(overhead + inputSize + outputsSize);
}

export async function prepareMultiInscriptionCommitTransaction(
  params: MultiInscriptionCommitParams
): Promise<MultiInscriptionCommitResult> {
  const { prepared, utxos, changeAddress, feeRate, network, minimumCommitAmount, selectedInscriptionUtxo, postagePerInscription } = params;

  if (!prepared?.commitAddress?.address) throw new Error('Invalid prepared batch inscription');
  if (!utxos?.length) throw new Error('No UTXOs provided');
  if (!changeAddress) throw new Error('Change address is required');
  if (feeRate <= 0) throw new Error(`Invalid fee rate: ${feeRate}`);

  const commitAmount = Math.max(
    minimumCommitAmount ?? 0,
    estimateRequiredCommitAmountForBatch(prepared, feeRate, postagePerInscription)
  );

  // Select inputs
  let selectedUtxos: Utxo[] = [];
  let totalInputValue = 0;
  if (selectedInscriptionUtxo) {
    selectedUtxos.push(selectedInscriptionUtxo);
    totalInputValue += selectedInscriptionUtxo.value;
  }
  for (const u of utxos) {
    if (selectedInscriptionUtxo && u.txid === selectedInscriptionUtxo.txid && u.vout === selectedInscriptionUtxo.vout) continue;
    if (totalInputValue >= commitAmount + 2000) break;
    selectedUtxos.push(u);
    totalInputValue += u.value;
  }
  if (totalInputValue < commitAmount) throw new Error('Insufficient funds for commit');

  const scureNetwork = getScureNetwork(network);
  const tx = new btc.Transaction();
  for (const utxo of selectedUtxos) {
    if (!utxo.scriptPubKey) continue;
    tx.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: Buffer.from(utxo.scriptPubKey, 'hex'),
        amount: BigInt(utxo.value)
      }
    });
  }

  // Estimate commit fee and set change accordingly to ensure non-zero fee
  const withChangeVBytes = estimateCommitTxSize(selectedUtxos.length, true);
  const withChangeFee = Number(calculateFee(withChangeVBytes, feeRate));
  let change = totalInputValue - commitAmount - withChangeFee;
  let includeChange = change >= MIN_DUST_LIMIT;
  if (!includeChange) {
    // Recalculate fee without change output
    const noChangeVBytes = estimateCommitTxSize(selectedUtxos.length, false);
    const noChangeFee = Number(calculateFee(noChangeVBytes, feeRate));
    change = totalInputValue - commitAmount - noChangeFee;
    includeChange = false; // ensure not added
  }

  // Add outputs
  tx.addOutputAddress(prepared.commitAddress.address, BigInt(commitAmount), scureNetwork);
  if (includeChange) {
    tx.addOutputAddress(changeAddress, BigInt(change), scureNetwork);
  }

  const psbt = tx.toPSBT();
  const commitPsbtBase64 = typeof psbt === 'string' ? psbt : Buffer.from(psbt).toString('base64');

  // Commit fee as inputs - outputs
  const outputsTotal = commitAmount + (includeChange ? change : 0);
  const fees = { commit: Math.max(0, totalInputValue - outputsTotal) };

  return {
    commitPsbtBase64,
    commitPsbt: tx,
    selectedUtxos,
    commitOutputValue: commitAmount,
    fees
  };
}


