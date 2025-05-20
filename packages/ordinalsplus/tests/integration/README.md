# Integration Tests

This directory contains integration tests that verify the interaction between multiple components of the OrdinalsPlus package.

## Purpose

Integration tests ensure that different parts of the system work together correctly. Unlike unit tests that focus on individual components in isolation, integration tests verify that components interact correctly when combined.

## Running Integration Tests

To run all integration tests:

```bash
npm test -- --testPathPattern=integration
```

## Test Files

- `inscription-flow.test.ts`: Tests the complete inscription creation flow from start to finish
- `error-handling.integration.test.ts`: Tests error handling across component boundaries

## Writing Integration Tests

When writing integration tests, please follow these guidelines:

1. Focus on testing the interaction between components
2. Use real implementations rather than mocks when possible
3. Test realistic user workflows
4. Document the components being tested and their expected interactions
5. Consider edge cases and error conditions
