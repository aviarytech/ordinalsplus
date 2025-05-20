# Unit Tests

This directory contains unit tests for individual components of the OrdinalsPlus package.

## Directory Structure

```
unit/
├── transactions/   # Tests for transaction-related functionality
├── inscriptions/   # Tests for inscription-related functionality
├── resources/      # Tests for resource-related functionality
├── did/            # Tests for DID-related functionality
├── utils/          # Tests for utility functions
└── key-management/ # Tests for key management functionality
```

## Running Unit Tests

To run all unit tests:

```bash
npm test -- --testPathPattern=unit
```

To run tests for a specific component:

```bash
npm test -- --testPathPattern=unit/transactions
```

## Writing Unit Tests

When writing unit tests, please follow these guidelines:

1. Test one component or function at a time
2. Mock external dependencies
3. Use descriptive test names that clearly indicate what is being tested
4. Follow the AAA pattern (Arrange, Act, Assert)
5. Keep tests small and focused
