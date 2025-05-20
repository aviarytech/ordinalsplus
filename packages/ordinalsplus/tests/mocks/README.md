# Test Mocks

This directory contains mock objects and data used across the test suite.

## Purpose

Mocks provide controlled test environments by simulating external dependencies and complex objects. They help create predictable test conditions and isolate the code being tested.

## Using Mocks

Import mocks from this directory when you need to simulate external dependencies in your tests:

```typescript
import { mockWallet } from '../mocks/wallet-mock';
```

## Creating New Mocks

When creating new mocks, please follow these guidelines:

1. Place mocks in this directory if they are used across multiple test files
2. Name mock files with a `-mock` suffix (e.g., `wallet-mock.ts`)
3. Document the behavior and limitations of the mock
4. Keep mocks simple and focused on the behavior needed for testing
