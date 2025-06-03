/**
 * Test utility for CBOR encoding/decoding
 * This helps verify that our CBOR implementation works correctly
 */

// Import cbor-js directly for testing
declare global {
  interface Window {
    CBOR: {
      encode: (value: any) => ArrayBuffer;
      decode: (buffer: ArrayBuffer) => any;
    };
  }
}

export interface CborTestResult {
  success: boolean;
  originalJson: string;
  cborHex: string;
  cborSize: number;
  decodedJson: string;
  roundTripSuccess: boolean;
  error?: string;
}

/**
 * Test CBOR encoding with a DID document
 * @param didDocument - The DID document to test
 * @returns Test results
 */
export function testCborEncoding(didDocument: any): CborTestResult {
  try {
    console.log('🧪 Testing CBOR encoding with DID document...');
    
    // Convert to JSON for comparison
    const originalJson = JSON.stringify(didDocument);
    console.log('📝 Original DID document:', didDocument);
    
    // Encode with cbor-js (same as our implementation)
    const cborBuffer = window.CBOR.encode(didDocument);
    const cborBytes = new Uint8Array(cborBuffer);
    
    // Convert to hex string (like ordinals.com shows)
    const cborHex = Array.from(cborBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    console.log(`📊 CBOR size: ${cborBytes.length} bytes`);
    console.log(`🔍 CBOR hex: ${cborHex}`);
    
    // Test decoding
    const decoded = window.CBOR.decode(cborBuffer);
    const decodedJson = JSON.stringify(decoded);
    
    const roundTripSuccess = originalJson === decodedJson;
    
    console.log('✅ CBOR encoding/decoding test completed');
    console.log(`🔄 Round-trip success: ${roundTripSuccess}`);
    
    return {
      success: true,
      originalJson,
      cborHex,
      cborSize: cborBytes.length,
      decodedJson,
      roundTripSuccess
    };
    
  } catch (error) {
    console.error('❌ CBOR test failed:', error);
    return {
      success: false,
      originalJson: '',
      cborHex: '',
      cborSize: 0,
      decodedJson: '',
      roundTripSuccess: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Load cbor-js library dynamically for testing
 */
export function loadCborJs(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.CBOR) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/cbor-js@0.1.0/dist/cbor.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load cbor-js'));
    document.head.appendChild(script);
  });
} 