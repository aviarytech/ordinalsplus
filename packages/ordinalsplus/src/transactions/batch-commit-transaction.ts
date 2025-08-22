import * as btc from '@scure/btc-signer';
import { PreparedInscription } from '../inscription/scripts/ordinal-reveal';
import { Utxo, BitcoinNetwork } from '../types';
import { calculateFee } from './fee-calculation';
import { selectUtxos, SimpleUtxoSelectionOptions } from './utxo-selection';
import { getScureNetwork } from '../utils/networks';
import { transactionTracker, TransactionStatus, TransactionType } from './transaction-status-tracker';

const MIN_DUST_LIMIT = 546;

export interface BatchCommitTransactionParams {
	inscriptions: PreparedInscription[];
	utxos: Utxo[];
	changeAddress: string;
	feeRate: number;
	network: BitcoinNetwork;
	postage: number; // sats per inscription output
	selectedInscriptionUtxo?: Utxo; // optional: forces first input
	minimumCommitAmountPerOutput?: number; // defaults to max(postage, dust)
}

export interface BatchCommitOutputInfo {
	index: number; // vout index in the commit tx
	address: string; // commit address
	amount: number; // postage used
}

export interface BatchCommitTransactionResult {
	commitPsbtBase64: string;
	commitPsbt: btc.Transaction;
	outputs: BatchCommitOutputInfo[];
	selectedUtxos: Utxo[];
	fees: { commit: number };
	transactionId: string;
}

function estimateCommitTxSize(inputCount: number, inscriptionOutputCount: number, includeChange: boolean): number {
	const overhead = 10.5;
	const inputSize = 68 * inputCount; // assume P2WPKH inputs
	const trOutputSize = 43; // P2TR output
	const p2wpkhOutputSize = 31; // change
	const outputsSize = inscriptionOutputCount * trOutputSize + (includeChange ? p2wpkhOutputSize : 0);
	return Math.ceil(overhead + inputSize + outputsSize);
}

export async function prepareBatchCommitTransaction(
	params: BatchCommitTransactionParams
): Promise<BatchCommitTransactionResult> {
	const {
		inscriptions,
		utxos,
		changeAddress,
		feeRate,
		network,
		postage,
		selectedInscriptionUtxo,
		minimumCommitAmountPerOutput,
	} = params;

	if (!Array.isArray(inscriptions) || inscriptions.length === 0) {
		throw new Error('No inscriptions provided.');
	}
	if (!utxos || utxos.length === 0) {
		throw new Error('No UTXOs provided to fund the transaction.');
	}
	if (!changeAddress) {
		throw new Error('Change address is required.');
	}
	if (feeRate <= 0) {
		throw new Error(`Invalid fee rate: ${feeRate}`);
	}
	if (postage <= 0) {
		throw new Error(`Invalid postage: ${postage}`);
	}

	const commitAddresses = inscriptions.map(i => {
		if (!i || !i.commitAddress || !i.commitAddress.address) {
			throw new Error('Invalid inscription: missing commit address information.');
		}
		return i.commitAddress.address;
	});

	const perOutputAmount = Math.max(minimumCommitAmountPerOutput ?? postage, MIN_DUST_LIMIT);
	const numOutputs = inscriptions.length;
	const outputTotal = perOutputAmount * numOutputs;

	let selectedUtxos: Utxo[] = [];
	let totalInputValue = 0;

	if (selectedInscriptionUtxo) {
		selectedUtxos.push(selectedInscriptionUtxo);
		totalInputValue = selectedInscriptionUtxo.value;
	}

	// initial estimate assumes change present
	const initialVBytes = estimateCommitTxSize(1, numOutputs, true);
	const initialFeeEstimate = Number(calculateFee(initialVBytes, feeRate));
	let totalNeeded = outputTotal + initialFeeEstimate;

	if (totalInputValue < totalNeeded) {
		const additionalAmountNeeded = totalNeeded - totalInputValue;
		const availableForFunding = selectedInscriptionUtxo
			? utxos.filter(u => !(u.txid === selectedInscriptionUtxo.txid && u.vout === selectedInscriptionUtxo.vout))
			: utxos;
		if (availableForFunding.length === 0) {
			throw new Error('Insufficient funds and no additional UTXOs available.');
		}
		const options: SimpleUtxoSelectionOptions = { targetAmount: additionalAmountNeeded };
		const funding = selectUtxos(availableForFunding, options);
		selectedUtxos.push(...funding.selectedUtxos);
		totalInputValue += funding.totalInputValue;
	}

	if (!selectedInscriptionUtxo && selectedUtxos.length === 0) {
		const options: SimpleUtxoSelectionOptions = { targetAmount: totalNeeded };
		const selection = selectUtxos(utxos, options);
		selectedUtxos = selection.selectedUtxos;
		totalInputValue = selection.totalInputValue;
	}

	if (!selectedUtxos.length) {
		throw new Error('No UTXOs selected for the transaction.');
	}

	const transactionId = `batch-commit-${Date.now()}`;
	transactionTracker.addTransaction({
		id: transactionId,
		txid: '',
		type: TransactionType.COMMIT,
		status: TransactionStatus.PENDING,
		createdAt: new Date(),
		lastUpdatedAt: new Date(),
		metadata: {
			feeRate,
			network,
			postage: perOutputAmount,
			outputs: numOutputs,
			selectedUtxos: selectedUtxos.map(u => ({ txid: u.txid, vout: u.vout, value: u.value }))
		}
	});

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

	// Add one P2TR output per inscription
	const outputs: BatchCommitOutputInfo[] = [];
	for (let i = 0; i < commitAddresses.length; i++) {
		const address = commitAddresses[i];
		tx.addOutputAddress(address, BigInt(perOutputAmount), scureNetwork);
		outputs.push({ index: i, address, amount: perOutputAmount });
	}

	// Recalculate fee with actual input count and with change placeholder
	const withChangeVBytes = estimateCommitTxSize(tx.inputsLength, numOutputs, true);
	const recalculatedFee = Number(calculateFee(withChangeVBytes, feeRate));

	// Compute change
	const changeAmount = totalInputValue - outputTotal - recalculatedFee;
	if (changeAmount >= MIN_DUST_LIMIT) {
		tx.addOutputAddress(changeAddress, BigInt(changeAmount), scureNetwork);
	} else {
		// fee effectively increases; no change output
	}

	// Finalize fee (if change below dust, fee = totalInputValue - outputs)
	const finalFee = totalInputValue - outputTotal - (changeAmount >= MIN_DUST_LIMIT ? changeAmount : 0);

	const txPsbt = tx.toPSBT();
	const commitPsbtBase64 = typeof txPsbt === 'string' ? txPsbt : Buffer.from(txPsbt).toString('base64');

	transactionTracker.setTransactionStatus(transactionId, TransactionStatus.CONFIRMING);
	transactionTracker.addTransactionProgressEvent({
		transactionId,
		message: `Prepared batch commit with ${numOutputs} outputs at ${perOutputAmount} sats each`,
		timestamp: new Date(),
		data: { commitPsbtBase64: commitPsbtBase64.slice(0, 20) + '...' }
	});

	return {
		commitPsbtBase64,
		commitPsbt: tx,
		outputs,
		selectedUtxos,
		fees: { commit: finalFee },
		transactionId
	};
}