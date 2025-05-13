# Tests for OrdinalsPlus Library

## Test Strategy

### PSBT Creation Tests

The tests for PSBT (Partially Signed Bitcoin Transaction) creation focus on verifying that the library can correctly:

1. **Create Basic PSBTs** - Tests the underlying Bitcoin.js functionality for creating basic PSBTs with inputs and outputs
2. **Handle Fee Calculations** - Ensures that fee calculations based on transaction size work correctly
3. **Encode Different Content Types** - Verifies proper handling of both text and binary inscription content
4. **Process Multiple UTXOs** - Tests the ability to handle multiple inputs when creating transactions

#### Implementation Notes

- **Txid Byte Order** - Bitcoin.js library internally reverses the byte order of transaction IDs from the standard hex format. The tests include helper functions (`reverseBuffer` and `txidToBuffer`) to handle this conversion properly when comparing expected values.

- **Test Isolation** - Instead of testing against the entire `createInscriptionPsbts` function which involves multiple complex operations, we test the core underlying functionality separately. This approach makes tests more resilient to implementation changes, while still ensuring the key components work correctly.

#### Running Tests

To run only the PSBT tests:

```bash
bun run test:psbt
```

This will run the tests with an extended timeout to accommodate the complex cryptographic operations.

## Other Test Modules

The full test suite covers various aspects of the library:

- Resource validation and parsing
- Cryptographic operations
- Transaction creation and signing
- Fee estimation
- UTXO selection and management

Each test module focuses on a specific area of functionality to ensure comprehensive test coverage while maintaining test isolation. 