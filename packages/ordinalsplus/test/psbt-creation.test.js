import { test, expect, describe } from "bun:test";
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
import { calculatePsbtFee, getBitcoinJsNetwork, createInscriptionScripts, createInscriptionPsbts, calculateTxFee } from '../src/transactions/psbt-creation';
// Initialize bitcoinjs-lib
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
// Set up the correct network for tests
const network = bitcoin.networks.testnet;
// Helper function to reverse buffer bytes (needed for txid comparison)
function reverseBuffer(buffer) {
    const reversed = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        reversed[i] = buffer[buffer.length - 1 - i];
    }
    return reversed;
}
// Helper function to convert hex string to reversed buffer
function txidToBuffer(txid) {
    return reverseBuffer(Buffer.from(txid, 'hex'));
}
describe('PSBT Creation Module Tests', () => {
    describe('Network Helpers', () => {
        test('should get the correct bitcoinjs network for mainnet', () => {
            const result = getBitcoinJsNetwork('mainnet');
            expect(result).toEqual(bitcoin.networks.bitcoin);
        });
        test('should get the correct bitcoinjs network for testnet', () => {
            // Using any to bypass type checking since testnet is supported in implementation
            // but not in the type definition
            const result = getBitcoinJsNetwork('testnet');
            expect(result).toEqual(bitcoin.networks.testnet);
        });
        test('should get the correct bitcoinjs network for signet', () => {
            const result = getBitcoinJsNetwork('signet');
            expect(result).toBeDefined();
            expect(result.bech32).toEqual('tb');
        });
        test('should throw for unsupported network type', () => {
            // @ts-ignore - Intentionally testing invalid input
            expect(() => getBitcoinJsNetwork('invalid')).toThrow(/Unsupported network type/);
        });
    });
    describe('Fee Calculation', () => {
        test('should calculate fee correctly based on vbytes and rate', () => {
            const vbytes = 250;
            const feeRate = 10;
            const result = calculatePsbtFee(vbytes, feeRate);
            expect(result).toEqual(2500);
        });
        test('should round up fee to the nearest satoshi', () => {
            const vbytes = 233;
            const feeRate = 2.5;
            const result = calculatePsbtFee(vbytes, feeRate);
            expect(result).toEqual(583); // 233 * 2.5 = 582.5, rounded up to 583
        });
    });
    describe('Inscription Scripts Creation', () => {
        test('should create valid inscription scripts', () => {
            // Create a keypair for testing
            const keyPair = ECPair.makeRandom({ network });
            // Create inscription data
            const inscriptionData = {
                contentType: Buffer.from('text/plain'),
                content: Buffer.from('Hello, Bitcoin!')
            };
            // Create inscription scripts
            const scripts = createInscriptionScripts(keyPair.publicKey, inscriptionData, network);
            // Check that all required fields are present
            expect(scripts.output).toBeDefined();
            expect(scripts.address).toBeDefined();
            expect(scripts.inscriptionScript).toBeDefined();
            expect(scripts.leafVersion).toBeDefined();
            expect(scripts.controlBlock).toBeDefined();
            expect(scripts.internalPubkey).toBeDefined();
            // Check that the address is valid for the network
            expect(scripts.address.startsWith('tb1')).toBe(true);
            // Check that the inscription script contains our content
            const scriptHex = scripts.inscriptionScript.toString('hex');
            const contentHex = Buffer.from('Hello, Bitcoin!').toString('hex');
            expect(scriptHex).toContain(contentHex);
        });
        test('should include metadata in inscription script when provided', () => {
            // Create a keypair for testing
            const keyPair = ECPair.makeRandom({ network });
            // Create inscription data with metadata
            const inscriptionData = {
                contentType: Buffer.from('text/plain'),
                content: Buffer.from('Hello with metadata!'),
                parentInscriptionId: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234567i0',
                metadata: {
                    'key1': 'value1',
                    'key2': 'value2'
                }
            };
            // Create inscription scripts
            const scripts = createInscriptionScripts(keyPair.publicKey, inscriptionData, network);
            // Convert to hex for easier checking
            const scriptHex = scripts.inscriptionScript.toString('hex');
            // Check for parent inscription ID
            const parentIdHex = Buffer.from('parent').toString('hex');
            expect(scriptHex).toContain(parentIdHex);
            // Check for metadata keys and values
            const key1Hex = Buffer.from('key1').toString('hex');
            const value1Hex = Buffer.from('value1').toString('hex');
            const key2Hex = Buffer.from('key2').toString('hex');
            const value2Hex = Buffer.from('value2').toString('hex');
            expect(scriptHex).toContain(key1Hex);
            expect(scriptHex).toContain(value1Hex);
            expect(scriptHex).toContain(key2Hex);
            expect(scriptHex).toContain(value2Hex);
        });
    });
    describe('Transaction Fee Calculation', () => {
        test('should calculate transaction fee from PSBT', () => {
            // Create a simple PSBT for testing
            const psbt = new bitcoin.Psbt({ network });
            // Add a dummy input
            const dummyTxid = '5e3ab20b5cdd8b988e2bdbf27d1fb63255e49a2fd6c0e0e7ac8d212deedf6511';
            const keyPair = ECPair.makeRandom({ network });
            const p2wpkh = bitcoin.payments.p2wpkh({
                pubkey: Buffer.from(keyPair.publicKey),
                network
            });
            psbt.addInput({
                hash: txidToBuffer(dummyTxid),
                index: 0,
                witnessUtxo: {
                    script: p2wpkh.output,
                    value: 20000
                }
            });
            // Add an output
            psbt.addOutput({
                address: p2wpkh.address,
                value: 15000
            });
            // Calculate fee
            const feeRate = 5;
            const fee = calculateTxFee(psbt, feeRate);
            // We can't check the exact value since it depends on extraction,
            // but we can check that it's a reasonable positive number
            expect(fee).toBeGreaterThan(0);
            expect(fee).toBeLessThan(20000); // Should not be unreasonably high
        });
    });
    describe('Full PSBT Creation', () => {
        test('should create inscription PSBTs in test mode', async () => {
            // Create test params
            const params = {
                contentType: 'text/plain',
                content: 'Hello, Bitcoin!',
                feeRate: 5,
                recipientAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', // testnet address
                utxos: [{
                        txid: '5e3ab20b5cdd8b988e2bdbf27d1fb63255e49a2fd6c0e0e7ac8d212deedf6511',
                        vout: 0,
                        value: 50000,
                        scriptPubKey: '00147dd65fb2a517fd4f16aa4df6a18003479bc6854a'
                    }],
                changeAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
                network: 'signet', // Changed to signet as it's a supported network type
                testMode: true
            };
            // Create the PSBTs
            const result = await createInscriptionPsbts(params);
            // Check the result
            expect(result.unsignedRevealPsbtBase64).toBeDefined();
            expect(result.unsignedRevealPsbtBase64.length).toBeGreaterThan(0);
            expect(result.revealSignerWif).toBeDefined();
            expect(result.commitTxOutputValue).toBeGreaterThan(0);
            expect(result.revealFee).toBeGreaterThan(0);
        });
    });
});
