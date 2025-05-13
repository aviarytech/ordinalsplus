import { describe, test, expect, beforeEach } from 'vitest';
import { 
  calculateFee, 
  formatFee, 
  estimateInscriptionFees, 
  getSelectedFeeRate,
  FeeRateLevel,
  estimateCommitTxSize,
  estimateRevealTxSize,
  estimateTotalFees,
  TX_SIZES
} from '../src/utils/fees';

// Skip the hooks test for now, as we need to setup proper mocking

describe('Fee Calculation Utils', () => {
  describe('calculateFee', () => {
    test('should calculate fee correctly based on vsize and fee rate', () => {
      // Test various combinations of vsize and fee rate
      expect(calculateFee(100, 10)).toBe(1000);
      expect(calculateFee(250, 8)).toBe(2000);
      expect(calculateFee(150, 5)).toBe(750);
    });

    test('should round up fee to the nearest satoshi', () => {
      // Test cases that require rounding
      expect(calculateFee(101, 1.5)).toBe(152); // 101 * 1.5 = 151.5, rounds to 152
      expect(calculateFee(200, 0.5)).toBe(100); // 200 * 0.5 = 100
      expect(calculateFee(300, 1.1)).toBe(330); // 300 * 1.1 = 330
    });

    test('should handle edge cases and invalid inputs', () => {
      // Test with null and undefined values
      expect(calculateFee(null, 10)).toBeNull();
      expect(calculateFee(100, null)).toBeNull();
      expect(calculateFee(undefined, 10)).toBeNull();
      expect(calculateFee(100, undefined)).toBeNull();
      
      // Test with non-positive values
      expect(calculateFee(0, 10)).toBeNull();
      expect(calculateFee(-50, 10)).toBeNull();
      expect(calculateFee(100, -5)).toBeNull();
    });
  });

  describe('formatFee', () => {
    test('should format fee correctly with thousands separators', () => {
      expect(formatFee(1000)).toBe('1,000 sats');
      expect(formatFee(1000000)).toBe('1,000,000 sats');
      expect(formatFee(123)).toBe('123 sats');
      expect(formatFee(1234567)).toBe('1,234,567 sats');
    });

    test('should handle edge cases and invalid inputs', () => {
      expect(formatFee(null)).toBe('');
      expect(formatFee(-100)).toBe('');
      expect(formatFee(0)).toBe('0 sats');
    });
  });
  
  describe('getSelectedFeeRate', () => {
    const mockFeeRates = {
      fastestFee: 25,
      halfHourFee: 15,
      hourFee: 5
    };
    
    test('should return the correct fee rate based on priority level', () => {
      expect(getSelectedFeeRate(mockFeeRates, FeeRateLevel.HIGH)).toBe(25);
      expect(getSelectedFeeRate(mockFeeRates, FeeRateLevel.MEDIUM)).toBe(15);
      expect(getSelectedFeeRate(mockFeeRates, FeeRateLevel.LOW)).toBe(5);
    });
    
    test('should use manual rate when provided and valid', () => {
      expect(getSelectedFeeRate(mockFeeRates, FeeRateLevel.MEDIUM, 10)).toBe(10);
      expect(getSelectedFeeRate(mockFeeRates, FeeRateLevel.HIGH, '12.5')).toBe(12.5);
    });
    
    test('should ignore invalid manual rates and fall back to level-based rate', () => {
      expect(getSelectedFeeRate(mockFeeRates, FeeRateLevel.HIGH, 'abc')).toBe(25);
      expect(getSelectedFeeRate(mockFeeRates, FeeRateLevel.MEDIUM, -5)).toBe(15);
      expect(getSelectedFeeRate(mockFeeRates, FeeRateLevel.LOW, 0)).toBe(5);
    });
    
    test('should handle null fee rates', () => {
      expect(getSelectedFeeRate(null, FeeRateLevel.MEDIUM)).toBeNull();
      expect(getSelectedFeeRate(null, FeeRateLevel.HIGH, 10)).toBe(10); // Manual rate still works
    });
  });
  
  describe('Transaction Size Estimation', () => {
    test('should estimate commit transaction size correctly', () => {
      // Test with different input counts and types
      expect(estimateCommitTxSize(1, 2, 'p2wpkh')).toBeGreaterThan(100);
      expect(estimateCommitTxSize(2, 2, 'p2wpkh')).toBeGreaterThan(
        estimateCommitTxSize(1, 2, 'p2wpkh')
      );
      expect(estimateCommitTxSize(1, 1, 'p2pkh')).toBeGreaterThan(
        estimateCommitTxSize(1, 1, 'p2wpkh')
      );
    });
    
    test('should estimate reveal transaction size correctly', () => {
      // Test with different inscription sizes
      const smallSize = estimateRevealTxSize(100, 'p2wpkh');
      const mediumSize = estimateRevealTxSize(1000, 'p2wpkh');
      const largeSize = estimateRevealTxSize(10000, 'p2wpkh');
      
      expect(mediumSize).toBeGreaterThan(smallSize);
      expect(largeSize).toBeGreaterThan(mediumSize);
      
      // Test with different output types
      expect(estimateRevealTxSize(1000, 'p2pkh')).toBeGreaterThan(
        estimateRevealTxSize(1000, 'p2wpkh')
      );
    });
    
    test('should calculate total fees correctly', () => {
      const commitSize = 150;
      const revealSize = 250;
      const feeRate = 10;
      
      const { commitFee, revealFee, totalFee } = estimateTotalFees(commitSize, revealSize, feeRate);
      
      expect(commitFee).toBe(1500); // 150 * 10
      expect(revealFee).toBe(2500); // 250 * 10
      expect(totalFee).toBe(4000); // 1500 + 2500
    });
  });
  
  describe('estimateInscriptionFees', () => {
    test('should estimate complete inscription fees correctly', () => {
      const inscriptionSize = 1000; // 1 KB
      const feeRate = 10; // 10 sats/vB
      
      const fees = estimateInscriptionFees(inscriptionSize, 1, feeRate, true, 'p2wpkh');
      
      expect(fees).not.toBeNull();
      if (fees) {
        expect(fees.commitTxSize).toBeGreaterThan(0);
        expect(fees.revealTxSize).toBeGreaterThan(0);
        expect(fees.commitFee).toBeGreaterThan(0);
        expect(fees.revealFee).toBeGreaterThan(0);
        expect(fees.totalFee).toBe(fees.commitFee + fees.revealFee);
        expect(fees.minimumRequiredAmount).toBe(fees.revealFee + TX_SIZES.DUST_LIMIT);
      }
    });
    
    test('should handle invalid inputs', () => {
      expect(estimateInscriptionFees(0, 1, 10)).toBeNull();
      expect(estimateInscriptionFees(100, 0, 10)).toBeNull();
      expect(estimateInscriptionFees(100, 1, 0)).toBeNull();
      expect(estimateInscriptionFees(-100, 1, 10)).toBeNull();
    });
    
    test('should account for different inscription sizes', () => {
      const smallFees = estimateInscriptionFees(100, 1, 10, true, 'p2wpkh');
      const mediumFees = estimateInscriptionFees(1000, 1, 10, true, 'p2wpkh');
      const largeFees = estimateInscriptionFees(10000, 1, 10, true, 'p2wpkh');
      
      expect(mediumFees?.revealTxSize).toBeGreaterThan(smallFees?.revealTxSize ?? 0);
      expect(largeFees?.revealTxSize).toBeGreaterThan(mediumFees?.revealTxSize ?? 0);
      
      expect(mediumFees?.revealFee).toBeGreaterThan(smallFees?.revealFee ?? 0);
      expect(largeFees?.revealFee).toBeGreaterThan(mediumFees?.revealFee ?? 0);
    });
  });
});

describe('Transaction Fee Estimation Integration', () => {
  test('should calculate total fee based on estimated vsize and fee rate', () => {
    // Mock values
    const estimatedVsize = 250; // vbytes
    const feeRate = 20; // sats/vbyte
    
    // Calculate expected result
    const expectedFee = 5000; // 250 * 20 = 5000 sats
    
    // Test the calculation function
    const calculatedFee = calculateFee(estimatedVsize, feeRate);
    
    expect(calculatedFee).toBe(expectedFee);
    expect(formatFee(calculatedFee)).toBe('5,000 sats');
  });
  
  test('should calculate commit and reveal transaction fees', () => {
    // Commit transaction - Simplified approximation
    const commitInputCount = 1;
    const commitOutputCount = 1;
    const commitVsize = 10 + (commitInputCount * 68) + (commitOutputCount * 31); // ≈ 109 vbytes
    
    // Reveal transaction - Simplified approximation
    const revealInputCount = 1;
    const revealOutputCount = 1;
    const controlBlockSize = 33;
    const scriptSize = 100; // Example size for a basic inscription
    const sigSize = 65;
    const witnessItemsCount = 3;
    const witnessSize = witnessItemsCount + sigSize + scriptSize + controlBlockSize;
    const revealBaseSize = 10 + 41 + 43; // Base + Input + Output ≈ 94
    const revealVsize = Math.ceil(revealBaseSize + witnessSize / 4); // ≈ 145 vbytes (actual calculation result)
    
    // Fee calculation for different fee rates
    const lowFeeRate = 5;
    const mediumFeeRate = 15;
    const highFeeRate = 25;
    
    // Expected results
    const expectedCommitFeeLow = 545; // 109 * 5 = 545 sats
    const expectedCommitFeeMedium = 1635; // 109 * 15 = 1635 sats
    const expectedCommitFeeHigh = 2725; // 109 * 25 = 2725 sats
    
    const expectedRevealFeeLow = 725; // 145 * 5 = 725 sats
    const expectedRevealFeeMedium = 2175; // 145 * 15 = 2175 sats
    const expectedRevealFeeHigh = 3625; // 145 * 25 = 3625 sats
    
    // Test commit fees
    expect(calculateFee(commitVsize, lowFeeRate)).toBe(expectedCommitFeeLow);
    expect(calculateFee(commitVsize, mediumFeeRate)).toBe(expectedCommitFeeMedium);
    expect(calculateFee(commitVsize, highFeeRate)).toBe(expectedCommitFeeHigh);
    
    // Test reveal fees
    expect(calculateFee(revealVsize, lowFeeRate)).toBe(expectedRevealFeeLow);
    expect(calculateFee(revealVsize, mediumFeeRate)).toBe(expectedRevealFeeMedium);
    expect(calculateFee(revealVsize, highFeeRate)).toBe(expectedRevealFeeHigh);
    
    // Calculate total fees (commit + reveal)
    const totalFeeLow = expectedCommitFeeLow + expectedRevealFeeLow;
    const totalFeeMedium = expectedCommitFeeMedium + expectedRevealFeeMedium;
    const totalFeeHigh = expectedCommitFeeHigh + expectedRevealFeeHigh;
    
    expect(totalFeeLow).toBe(1270); // 545 + 725 = 1270 sats
    expect(totalFeeMedium).toBe(3810); // 1635 + 2175 = 3810 sats
    expect(totalFeeHigh).toBe(6350); // 2725 + 3625 = 6350 sats
  });
  
  test('should integrate with full estimateInscriptionFees workflow', () => {
    const inscriptionSize = 500; // bytes
    const feeRate = 10; // sats/vB
    
    // Calculate fees directly
    const fees = estimateInscriptionFees(inscriptionSize, 1, feeRate);
    expect(fees).not.toBeNull();
    
    if (fees) {
      // Verify our fee calculation matches the expected formula
      expect(fees.commitFee).toBe(calculateFee(fees.commitTxSize, feeRate));
      expect(fees.revealFee).toBe(calculateFee(fees.revealTxSize, feeRate));
      expect(fees.totalFee).toBe(fees.commitFee + fees.revealFee);
    }
  });
}); 