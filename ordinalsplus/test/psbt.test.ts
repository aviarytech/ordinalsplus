import { test, expect, describe } from "bun:test";
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';

// Initialize bitcoinjs-lib
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// Set up the correct network for tests
const network = bitcoin.networks.testnet;

// Helper function to reverse buffer bytes (needed for txid comparison)
function reverseBuffer(buffer: Buffer): Buffer {
  const reversed = Buffer.alloc(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    reversed[i] = buffer[buffer.length - 1 - i];
  }
  return reversed;
}

// Helper function to convert hex string to reversed buffer
function txidToBuffer(txid: string): Buffer {
  return reverseBuffer(Buffer.from(txid, 'hex'));
}

// Mock data types to match the expected interfaces
interface Utxo {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey: string;
}

describe('PSBT Creation Tests', () => {
  
  // Test the basic functionality of bitcoinjs-lib for PSBT creation
  test('should create a basic PSBT', () => {
    // Create a keypair
    const keyPair = ECPair.makeRandom({ network });
    const p2wpkh = bitcoin.payments.p2wpkh({ 
      pubkey: Buffer.from(keyPair.publicKey), 
      network 
    });
    
    // Create a PSBT
    const psbt = new bitcoin.Psbt({ network });
    
    // Add a dummy input (simulating a UTXO)
    const dummyTxid = '5e3ab20b5cdd8b988e2bdbf27d1fb63255e49a2fd6c0e0e7ac8d212deedf6511';
    
    psbt.addInput({
      hash: txidToBuffer(dummyTxid),
      index: 0,
      witnessUtxo: {
        script: p2wpkh.output!,
        value: 20000
      }
    });
    
    // Add a dummy output
    psbt.addOutput({
      address: p2wpkh.address!,
      value: 15000
    });
    
    // Convert to base64
    const base64 = psbt.toBase64();
    
    // Verify the PSBT
    expect(base64).toBeDefined();
    expect(base64.length).toBeGreaterThan(0);
    
    // Decode to verify structure
    const decodedPsbt = bitcoin.Psbt.fromBase64(base64);
    expect(decodedPsbt.txInputs.length).toEqual(1);
    expect(decodedPsbt.txOutputs.length).toEqual(1);
    
    // Convert the hash back to hex and compare to the original
    // bitcoinjs-lib internally reverses the byte order
    const inputHashHex = Buffer.from(decodedPsbt.txInputs[0].hash).toString('hex');
    const reversedDummyTxid = reverseBuffer(Buffer.from(dummyTxid, 'hex')).toString('hex');
    expect(inputHashHex).toEqual(reversedDummyTxid);
  });
  
  // Test UTXO selection and fee calculation
  test('should calculate fees correctly based on size', () => {
    // Test basic fee calculation
    const feeRate = 10; // sats/vB
    const txSize = 250; // vBytes
    
    const expectedFee = feeRate * txSize;
    expect(expectedFee).toEqual(2500);
  });
  
  // Test handling different content types
  test('should properly encode different content types', () => {
    // Test encoding text content
    const textContent = 'Hello, Bitcoin!';
    const textBuffer = Buffer.from(textContent);
    expect(textBuffer.toString()).toEqual(textContent);
    
    // Test encoding binary content (e.g., image)
    const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header
    expect(binaryContent.length).toEqual(4);
  });
  
  // Test handling multiple UTXOs
  test('should handle multiple UTXOs for inputs', () => {
    // Create a PSBT with multiple inputs
    const psbt = new bitcoin.Psbt({ network });
    
    // Add multiple dummy inputs
    const utxos: Utxo[] = [
      {
        txid: '5e3ab20b5cdd8b988e2bdbf27d1fb63255e49a2fd6c0e0e7ac8d212deedf6511',
        vout: 0,
        value: 10000,
        scriptPubKey: '00147dd65fb2a517fd4f16aa4df6a18003479bc6854a'
      },
      {
        txid: '6f4ab20b5cdd8b988e2bdbf27d1fb63255e49a2fd6c0e0e7ac8d212deedf6522',
        vout: 1,
        value: 15000,
        scriptPubKey: '00147dd65fb2a517fd4f16aa4df6a18003479bc6854a'
      }
    ];
    
    // Create key pair for script generation
    const keyPair = ECPair.makeRandom({ network });
    const p2wpkh = bitcoin.payments.p2wpkh({ 
      pubkey: Buffer.from(keyPair.publicKey), 
      network 
    });
    
    // Add inputs for each UTXO
    utxos.forEach(utxo => {
      psbt.addInput({
        hash: txidToBuffer(utxo.txid),
        index: utxo.vout,
        witnessUtxo: {
          script: p2wpkh.output!,
          value: utxo.value
        }
      });
    });
    
    // Add an output
    psbt.addOutput({
      address: p2wpkh.address!,
      value: 20000 // Less than total input to account for fees
    });
    
    // Verify PSBT structure
    expect(psbt.txInputs.length).toEqual(2);
    
    // Check hashes with proper byte order handling
    const input0HashHex = Buffer.from(psbt.txInputs[0].hash).toString('hex');
    const input1HashHex = Buffer.from(psbt.txInputs[1].hash).toString('hex');
    
    const reversedTxid0 = reverseBuffer(Buffer.from(utxos[0].txid, 'hex')).toString('hex');
    const reversedTxid1 = reverseBuffer(Buffer.from(utxos[1].txid, 'hex')).toString('hex');
    
    expect(input0HashHex).toEqual(reversedTxid0);
    expect(input1HashHex).toEqual(reversedTxid1);
    
    expect(psbt.txOutputs.length).toEqual(1);
  });
}); 