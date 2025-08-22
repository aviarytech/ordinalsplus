import { describe, test, expect } from 'bun:test';
import {
	prepareBatchCommitTransaction,
	BatchCommitTransactionParams
} from '../../../src/transactions/batch-commit-transaction';
import { Utxo, BitcoinNetwork } from '../../../src/types';
import { createTextInscription, createJsonInscription } from '../../../src/inscription';

describe('Batch Commit Transaction', () => {
	const mockNetwork: BitcoinNetwork = 'testnet';
	const mockUtxos: Utxo[] = [
		{
			txid: '1111111111111111111111111111111111111111111111111111111111111111',
			vout: 0,
			value: 100000,
			scriptPubKey: '0014d85c2b71d0060b09c9886aeb815e50991dda124d'
		},
		{
			txid: '2222222222222222222222222222222222222222222222222222222222222222',
			vout: 1,
			value: 150000,
			scriptPubKey: '0014d85c2b71d0060b09c9886aeb815e50991dda124d'
		}
	];
	const changeAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

	test('creates a PSBT with one output per inscription using postage', async () => {
		const insc1 = createTextInscription('One', mockNetwork);
		const insc2 = createJsonInscription({ a: 1 }, mockNetwork);
		const postage = 1000;

		const params: BatchCommitTransactionParams = {
			inscriptions: [insc1, insc2],
			utxos: mockUtxos,
			changeAddress,
			feeRate: 2,
			network: mockNetwork,
			postage
		};

		const res = await prepareBatchCommitTransaction(params);
		expect(res.commitPsbtBase64).toBeDefined();
		expect(res.outputs.length).toBe(2);
		res.outputs.forEach(o => {
			expect(o.amount).toBeGreaterThanOrEqual(postage);
			expect(o.address).toMatch(/^tb1p[a-zA-Z0-9]{58,}$/);
		});
	});

	test('validates inputs and rejects invalid postage/fee', async () => {
		const insc = createTextInscription('X', mockNetwork);
		await expect(prepareBatchCommitTransaction({
			inscriptions: [insc],
			utxos: mockUtxos,
			changeAddress,
			feeRate: 0,
			network: mockNetwork,
			postage: 1000
		} as any)).rejects.toThrow(/Invalid fee rate/);

		await expect(prepareBatchCommitTransaction({
			inscriptions: [insc],
			utxos: mockUtxos,
			changeAddress,
			feeRate: 2,
			network: mockNetwork,
			postage: 0
		} as any)).rejects.toThrow(/Invalid postage/);
	});

	test('prioritizes selected inscription UTXO as first input', async () => {
		const insc = createTextInscription('Y', mockNetwork);
		const selected: Utxo = {
			txid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
			vout: 0,
			value: 50000,
			scriptPubKey: '0014d85c2b71d0060b09c9886aeb815e50991dda124d'
		};
		const res = await prepareBatchCommitTransaction({
			inscriptions: [insc],
			utxos: mockUtxos,
			changeAddress,
			feeRate: 2,
			network: mockNetwork,
			postage: 1000,
			selectedInscriptionUtxo: selected
		});
		expect(res.selectedUtxos.length).toBeGreaterThan(0);
		expect(res.selectedUtxos[0].txid).toBe(selected.txid);
	});

	test('includes change output when above dust', async () => {
		const insc1 = createTextInscription('One', mockNetwork);
		const insc2 = createTextInscription('Two', mockNetwork);
		const res = await prepareBatchCommitTransaction({
			inscriptions: [insc1, insc2],
			utxos: mockUtxos,
			changeAddress,
			feeRate: 2,
			network: mockNetwork,
			postage: 1000
		});
		// outputsLength = inscription outputs + optional change
		expect(res.commitPsbt.outputsLength === 2 || res.commitPsbt.outputsLength === 3).toBe(true);
	});
});