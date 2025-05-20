# Performance Tests

This directory contains performance tests for the OrdinalsPlus package.

## Purpose

Performance tests measure the execution time, resource usage, and scalability of critical operations. These tests help identify bottlenecks and ensure that the system meets performance requirements.

## Running Performance Tests

To run all performance tests:

```bash
npm test -- --testPathPattern=performance
```

## Test Files

- `inscription-performance.test.ts`: Measures the performance of inscription creation operations

## Writing Performance Tests

When writing performance tests, please follow these guidelines:

1. Measure specific operations with clear performance expectations
2. Use appropriate sample sizes for meaningful results
3. Include baseline measurements for comparison
4. Document the performance expectations and thresholds
5. Consider different load conditions and edge cases
