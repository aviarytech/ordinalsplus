# OrdinalsPlus Testing Guide

This document provides guidelines for testing across all packages in the OrdinalsPlus project.

## Test Organization

Tests are organized according to the following principles:

1. **Test Types**: Tests are categorized by type (unit, integration, e2e, performance)
2. **Functional Areas**: Within each type, tests are further organized by functional area
3. **Package-Specific Patterns**: Each package follows its own testing pattern based on its architecture

### OrdinalsPlus Package

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

### Ordinals-Plus-API Package

```
src/
├── controllers/
│   └── __tests__/      # Unit tests for controllers
├── services/
│   └── __tests__/      # Unit tests for services
├── utils/
│   └── __tests__/      # Unit tests for utilities
└── integration-tests/  # Integration tests for API endpoints
```

### Ordinals-Plus-Explorer Package

```
tests/
├── unit/              # Unit tests for non-UI functionality
├── components/        # Tests for React components
├── integration/       # Integration tests for UI workflows
└── mocks/             # Mock objects for testing
```

## Test Naming Conventions

- Unit test files: `[component-name].test.ts`
- Integration test files: `[feature].integration.test.ts`
- E2E test files: `[workflow].e2e.test.ts`
- Performance test files: `[feature].performance.test.ts`
- Component test files: `[component-name].test.tsx`

## Running Tests

### Running All Tests

```bash
npm test
```

### Running Tests for a Specific Package

```bash
cd packages/ordinalsplus
npm test
```

### Running a Specific Test Type

```bash
npm test -- --testPathPattern=unit
```

### Running Tests for a Specific Feature

```bash
npm test -- --testPathPattern=inscriptions
```

## Writing Tests

### General Guidelines

1. **Test One Thing at a Time**: Each test should focus on a single behavior or feature
2. **Descriptive Test Names**: Use descriptive names that clearly indicate what is being tested
3. **AAA Pattern**: Follow the Arrange-Act-Assert pattern
4. **Isolation**: Tests should be independent and not rely on the state from other tests
5. **Clean Up**: Tests should clean up after themselves

### Test Types

#### Unit Tests

- Test individual components in isolation
- Mock external dependencies
- Focus on specific behaviors and edge cases

#### Integration Tests

- Test interactions between components
- Use real implementations when possible
- Focus on component boundaries and interfaces

#### E2E Tests

- Test complete user workflows
- Minimize mocking
- Focus on user-facing behavior

#### Performance Tests

- Measure execution time and resource usage
- Include baseline measurements
- Document performance expectations

## Test Coverage

We aim for high test coverage across all packages, with a minimum target of 80% code coverage. Coverage reports can be generated using:

```bash
npm run test:coverage
```

## Continuous Integration

All tests are run as part of our CI pipeline. Pull requests must pass all tests before they can be merged.
