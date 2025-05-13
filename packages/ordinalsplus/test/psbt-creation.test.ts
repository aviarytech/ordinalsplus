import { test, expect, describe } from "bun:test";
import { hex, base64 } from '@scure/base';
import { bytesToHex, hexToBytes, concatBytes } from '@noble/hashes/utils';
import * as btc from '@scure/btc-signer';
import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha2';
import { 
  calculatePsbtFee, 
  getScureNetwork, 
  createInscriptionScripts,
  createInscriptionPsbts,
  calculateTxFee,
  InscriptionData,
  NETWORKS
} from '../src/transactions/psbt-creation';
import { BitcoinNetwork } from '../src/types';

// Set up the correct network for tests
const network = NETWORKS.testnet;

// Helper function to reverse bytes (needed for txid comparison)
function reverseBytes(bytes: Uint8Array): Uint8Array {
  const reversed = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    reversed[i] = bytes[bytes.length - 1 - i];
  }
  return reversed;
}

// Helper function to convert hex string to reversed bytes
function txidToBytes(txid: string): Uint8Array {
  return reverseBytes(hexToBytes(txid));
}

// Mock data types to match the expected interfaces
interface Utxo {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey: string;
}

describe('PSBT Creation Module Tests', () => {
  describe('Network Helpers', () => {
    test('should get the correct scure network for mainnet', () => {
      const result = getScureNetwork('mainnet');
      expect(result).toEqual(NETWORKS.bitcoin);
    });
    
    test('should get the correct scure network for testnet', () => {
      const result = getScureNetwork('testnet');
      expect(result).toEqual(NETWORKS.testnet);
    });
    
    test('should get the correct scure network for signet', () => {
      const result = getScureNetwork('signet');
      expect(result).toBeDefined();
      expect(result.bech32).toEqual('tb');
    });
    
    test('should throw for unsupported network type', () => {
      // @ts-ignore - Intentionally testing invalid input
      expect(() => getScureNetwork('invalid')).toThrow(/Unsupported network type/);
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
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);
      
      // Create inscription data
      const inscriptionData: InscriptionData = {
        contentType: new TextEncoder().encode('text/plain'),
        content: new TextEncoder().encode('Hello, Bitcoin!')
      };
      
      // Create inscription scripts
      const scripts = createInscriptionScripts(publicKey, inscriptionData, network);
      
      // Check that all required fields are present
      expect(scripts.output).toBeDefined();
      expect(scripts.address).toBeDefined();
      expect(scripts.inscriptionScript).toBeDefined();
      expect(scripts.leafVersion).toBeDefined();
      expect(scripts.controlBlock).toBeDefined();
      expect(scripts.internalKey).toBeDefined();
      
      // Check that the address is valid for the network (first part should match bech32 prefix)
      expect(scripts.address.startsWith(network.bech32)).toBe(true);
      
      // Check that the inscription script contains our content
      const scriptHex = bytesToHex(scripts.inscriptionScript);
      const contentHex = bytesToHex(new TextEncoder().encode('Hello, Bitcoin!'));
      expect(scriptHex).toContain(contentHex);
    });
    
    test('should include metadata in inscription script when provided', () => {
      // Create a keypair for testing
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);
      
      // Create inscription data with metadata
      const inscriptionData: InscriptionData = {
        contentType: new TextEncoder().encode('text/plain'),
        content: new TextEncoder().encode('Hello with metadata!'),
        parentInscriptionId: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234567i0',
        metadata: {
          'key1': 'value1',
          'key2': 'value2'
        }
      };
      
      // Create inscription scripts
      const scripts = createInscriptionScripts(publicKey, inscriptionData, network);
      
      // Convert to hex for easier checking
      const scriptHex = bytesToHex(scripts.inscriptionScript);
      
      // Check for parent inscription ID
      const parentIdHex = bytesToHex(new TextEncoder().encode('parent'));
      expect(scriptHex).toContain(parentIdHex);
      
      // Check for metadata keys and values
      const key1Hex = bytesToHex(new TextEncoder().encode('key1'));
      const value1Hex = bytesToHex(new TextEncoder().encode('value1'));
      const key2Hex = bytesToHex(new TextEncoder().encode('key2'));
      const value2Hex = bytesToHex(new TextEncoder().encode('value2'));
      
      expect(scriptHex).toContain(key1Hex);
      expect(scriptHex).toContain(value1Hex);
      expect(scriptHex).toContain(key2Hex);
      expect(scriptHex).toContain(value2Hex);
    });
  });

  describe('Transaction Fee Calculation', () => {
    test('should calculate transaction fee from Transaction', () => {
      // Create a simple Transaction for testing
      const tx = new btc.Transaction();
      
      // Add a dummy input
      const dummyTxid = '5e3ab20b5cdd8b988e2bdbf27d1fb63255e49a2fd6c0e0e7ac8d212deedf6511';
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);
      
      // Create a simple P2WPKH script for testing
      const p2wpkhScript = concatBytes(
        new Uint8Array([0x00, 0x14]), // OP_0 PUSH_BYTES(20)
        sha256(publicKey).slice(0, 20) // First 20 bytes of hash
      );
      
      tx.addInput({
        txid: dummyTxid,
        index: 0,
        witnessUtxo: {
          script: p2wpkhScript,
          amount: BigInt(20000)
        }
      });
      
      // Add an output - using direct script for simplicity
      tx.addOutput({
        script: p2wpkhScript,
        amount: BigInt(15000)
      });
      
      // Calculate fee
      const feeRate = 5;
      const fee = calculateTxFee(tx, feeRate);
      
      // We can't check the exact value since it depends on specific implementation,
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
        network: 'signet' as BitcoinNetwork, // Changed to signet as it's a supported network type
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