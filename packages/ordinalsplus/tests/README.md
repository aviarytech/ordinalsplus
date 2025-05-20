# OrdinalsPlus Test Suite

This directory contains all tests for the OrdinalsPlus package, organized into a consistent structure.

## Directory Structure

```
tests/
├── unit/               # Unit tests for individual components
│   ├── transactions/   # Tests for transaction-related functionality
│   ├── inscriptions/   # Tests for inscription-related functionality
│   ├── resources/      # Tests for resource-related functionality
│   ├── did/            # Tests for DID-related functionality
│   ├── utils/          # Tests for utility functions
│   └── key-management/ # Tests for key management functionality
├── integration/        # Integration tests that test multiple components together
├── e2e/                # End-to-end tests that simulate user workflows
├── performance/        # Performance and benchmark tests
└── mocks/              # Mock objects and data for testing
```

## Running Tests

To run all tests:

```bash
npm test
```

To run a specific test category:

```bash
npm test -- --testPathPattern=unit/transactions
```

## Adding New Tests

When adding new tests, please follow these guidelines:

1. Place the test in the appropriate directory based on its type and the functionality it tests
2. Name test files with the `.test.ts` extension
3. Use descriptive test names that clearly indicate what is being tested
4. Include appropriate test documentation and comments
5. Follow the existing test patterns for consistency

## Test Naming Conventions

- Unit test files: `[component-name].test.ts`
- Integration test files: `[feature].integration.test.ts`
- E2E test files: `[workflow].e2e.test.ts`
- Performance test files: `[feature].performance.test.ts`

## Test Organization Philosophy

Tests are organized first by test type (unit, integration, e2e, performance) and then by functional area. This makes it easier to:

1. Run all tests of a specific type
2. Find tests related to a specific feature or component
3. Understand the test coverage for each area of the codebase
