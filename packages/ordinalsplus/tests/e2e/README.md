# End-to-End Tests

This directory contains end-to-end tests for the OrdinalsPlus package.

## Purpose

End-to-end tests verify that the entire system works correctly from the user's perspective. These tests simulate real user workflows and ensure that all components work together as expected in a production-like environment.

## Running E2E Tests

To run all end-to-end tests:

```bash
npm test -- --testPathPattern=e2e
```

## Writing E2E Tests

When writing end-to-end tests, please follow these guidelines:

1. Test complete user workflows from start to finish
2. Use real external dependencies when possible
3. Minimize mocking to ensure realistic testing
4. Document the workflow being tested
5. Include cleanup steps to leave the system in a clean state after testing
