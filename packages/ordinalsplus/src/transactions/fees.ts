/**
 * Fee Calculation Module
 * 
 * Provides functionality to estimate transaction fees for inscriptions
 */

/**
 * Calculate fees for both commit and reveal transactions
 * 
 * @param content The content to be inscribed
 * @param contentType MIME type of the content
 * @param feeRate Fee rate in sats/vbyte
 * @returns Object containing commit, reveal, and total fees
 */
export async function calculateFees(
  content: any, 
  contentType: string, 
  feeRate: number
): Promise<{ commit: number; reveal: number; total: number }> {
  // Estimate content size in bytes
  let contentSizeBytes = 0;
  
  if (typeof content === 'string') {
    contentSizeBytes = new TextEncoder().encode(content).length;
  } else if (content instanceof Buffer || content instanceof Uint8Array) {
    contentSizeBytes = content.length;
  } else if (typeof content === 'object') {
    contentSizeBytes = new TextEncoder().encode(JSON.stringify(content)).length;
  }
  
  // Base sizes for transactions (approximation)
  const COMMIT_TX_BASE_SIZE = 110; // Base size for a simple commit transaction in vbytes
  const REVEAL_TX_BASE_SIZE = 130; // Base size for the reveal transaction without the inscription
  
  // Calculate inscription size overhead (protocol overhead + content)
  // Protocol overhead includes mime type encoding, metadata, etc.
  const PROTOCOL_OVERHEAD = 30; // Approximation for ordinal protocol overhead
  const inscriptionSize = contentSizeBytes + PROTOCOL_OVERHEAD;
  
  // Calculate transaction sizes in vbytes
  const commitTxSize = COMMIT_TX_BASE_SIZE;
  const revealTxSize = REVEAL_TX_BASE_SIZE + (inscriptionSize / 4); // Witness data is discounted
  
  // Calculate fees
  const commitFee = Math.ceil(commitTxSize * feeRate);
  const revealFee = Math.ceil(revealTxSize * feeRate);
  const totalFee = commitFee + revealFee;
  
  return {
    commit: commitFee,
    reveal: revealFee,
    total: totalFee
  };
} 