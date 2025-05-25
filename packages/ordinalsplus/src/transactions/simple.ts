import * as btc from '@scure/btc-signer';
import * as ordinals from 'micro-ordinals';
import { base64, hex } from '@scure/base';
import { PreparedInscription } from '../inscription/scripts/ordinal-reveal';
import { Utxo, BitcoinNetwork } from '../types';
import { calculateFee } from './fee-calculation';
import { getScureNetwork } from '../utils/networks';
import { CommitTransactionResult } from './commit-transaction';
import { RevealTransactionResult } from './reveal-transaction';

const MIN_DUST_LIMIT = 546;
const POSTAGE_VALUE = 551n;

export interface SimpleCommitParams {
  inscription: PreparedInscription;
  utxo: Utxo;
  changeAddress: string;
  feeRate: number;
  network?: BitcoinNetwork;
}

export async function createSimpleCommitTransaction(params: SimpleCommitParams): Promise<CommitTransactionResult> {
  const { inscription, utxo, changeAddress, feeRate, network = 'mainnet' } = params;
  const net = getScureNetwork(network);

  const tx = new btc.Transaction();
  if (!utxo.scriptPubKey) {
    throw new Error('UTXO missing scriptPubKey');
  }
  tx.addInput({
    txid: utxo.txid,
    index: utxo.vout,
    witnessUtxo: {
      script: Buffer.from(utxo.scriptPubKey, 'hex'),
      amount: BigInt(utxo.value)
    }
  });

  const commitValue = MIN_DUST_LIMIT;
  const estimatedSize = 68 + 43 + 31 + 10; // rough vbytes for 1 input 2 outputs
  const fee = Number(calculateFee(estimatedSize, feeRate));

  if (utxo.value < commitValue + fee) {
    throw new Error('UTXO value too low for commit transaction');
  }

  tx.addOutputAddress(inscription.commitAddress.address, BigInt(commitValue), net);
  const change = utxo.value - commitValue - fee;
  if (change > 0) {
    tx.addOutputAddress(changeAddress, BigInt(change), net);
  }

  const psbt = tx.toPSBT();
  const psbt64 = typeof psbt === 'string' ? psbt : Buffer.from(psbt).toString('base64');

  return {
    commitAddress: inscription.commitAddress.address,
    commitPsbtBase64: psbt64,
    commitPsbt: tx,
    requiredCommitAmount: commitValue,
    selectedUtxos: [utxo],
    fees: { commit: fee },
  };
}

export interface SimpleRevealParams {
  utxo: Utxo;
  preparedInscription: PreparedInscription;
  feeRate: number;
  privateKey?: Uint8Array;
  network?: BitcoinNetwork;
  destinationAddress?: string;
}

export async function createSimpleRevealTransaction(params: SimpleRevealParams): Promise<RevealTransactionResult> {
  const { utxo, preparedInscription, feeRate, privateKey, network = 'mainnet', destinationAddress } = params;
  const net = getScureNetwork(network);
  const customScripts = [ordinals.OutOrdinalReveal];
  const revealPayment = btc.p2tr(undefined as any, ordinals.p2tr_ord_reveal(preparedInscription.revealPublicKey, [preparedInscription.inscription]), net, false, customScripts);

  const tx = new btc.Transaction({ customScripts });
  tx.addInput({
    ...revealPayment,
    txid: utxo.txid,
    index: utxo.vout,
    witnessUtxo: {
      script: preparedInscription.commitAddress.script,
      amount: BigInt(utxo.value),
    }
  });

  const inscSize = preparedInscription.inscription.body?.length || 0;
  const estimatedVsize = 200 + Math.ceil(inscSize * 1.02);
  const fee = BigInt(calculateFee(estimatedVsize, feeRate));

  const outAddr = destinationAddress || preparedInscription.commitAddress.address;
  tx.addOutputAddress(outAddr, POSTAGE_VALUE, net);
  const change = BigInt(utxo.value) - fee - POSTAGE_VALUE;
  if (change > 0 && utxo.script?.address) {
    tx.addOutputAddress(utxo.script.address, change, net);
  }

  if (privateKey) {
    tx.sign(privateKey);
    tx.finalize();
    const bytes = tx.extract();
    return {
      tx,
      fee: Number(fee),
      vsize: estimatedVsize,
      hex: hex.encode(bytes),
      base64: base64.encode(bytes),
      transactionId: '',
    };
  }

  const psbt = tx.toPSBT();
  const psbt64 = typeof psbt === 'string' ? psbt : Buffer.from(psbt).toString('base64');
  return {
    tx,
    fee: Number(fee),
    vsize: estimatedVsize,
    hex: psbt64,
    base64: psbt64,
    transactionId: '',
  };
}
