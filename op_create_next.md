# Ordinals Plus Testing PRD: Inscription Metadata Writing to Signet

## Overview

This Product Requirements Document (PRD) outlines a testing initiative for the Ordinals Plus project, focusing on ensuring the functionality of writing inscriptions with metadata to the Bitcoin Signet network. The project is currently at approximately 90% completion, with basic file writing to Signet already successful. The next critical step is to verify and ensure proper metadata writing functionality.

## Project Context

Ordinals Plus consists of three main packages:
1. **ordinalsplus** - Core library implementing inscription functionality
2. **ordinals-plus-api** - API service for interacting with the Bitcoin network
3. **ordinals-plus-explorer** - Frontend explorer application

The project has successfully written basic file inscriptions to the Signet network. However, the metadata writing functionality needs comprehensive testing to ensure it works correctly before proceeding to mainnet deployment.

## Testing Goals

1. Organize existing tests into coherent test suites for each package
2. Verify metadata writing functionality on the Signet network
3. Ensure proper error handling and recovery for failed inscription attempts
4. Document the testing process and results for future reference

## Testing Phases

### Phase 1: Test Organization and Baseline Establishment

**Objective:** Organize existing tests into coherent test suites and establish a baseline for further testing.

**Tasks:**
1. Audit existing tests across all three packages
2. Organize tests into logical suites based on functionality
3. Ensure all tests are properly documented with clear descriptions
4. Create a test runner configuration for each package
5. Establish CI/CD pipeline integration for automated testing
6. Document test coverage and identify gaps

**Deliverables:**
- Organized test suites for each package
- Test coverage report
- Gap analysis document

### Phase 2: Metadata Writing Test Development

**Objective:** Develop comprehensive tests for metadata writing functionality on the Signet network.

**Tasks:**
1. Create unit tests for metadata encoding/decoding
2. Develop integration tests for metadata inclusion in inscriptions
3. Create end-to-end tests for the complete inscription process with metadata
4. Implement tests for various metadata formats and sizes
5. Test metadata validation and error handling
6. Verify metadata retrieval and parsing from inscriptions

**Deliverables:**
- Unit test suite for metadata handling
- Integration test suite for metadata inscription
- End-to-end test suite for complete workflow
- Documentation of test scenarios and expected results

### Phase 3: Signet Network Testing

**Objective:** Verify metadata writing functionality on the Signet network with real transactions.

**Tasks:**
1. Set up a Signet testing environment with proper configuration
2. Create test wallets and fund them with Signet coins
3. Implement automated tests for writing inscriptions with metadata to Signet
4. Test various inscription sizes and metadata combinations
5. Verify transaction confirmation and inscription indexing
6. Test error scenarios and recovery mechanisms
7. Document network-specific considerations and limitations

**Deliverables:**
- Signet testing environment setup guide
- Automated test suite for Signet inscriptions
- Test results documentation
- Performance metrics for different inscription sizes and types

### Phase 4: Error Handling and Recovery Testing

**Objective:** Ensure robust error handling and recovery mechanisms for failed inscription attempts.

**Tasks:**
1. Test network interruption scenarios
2. Verify transaction fee estimation and handling
3. Test UTXO selection and management
4. Implement tests for transaction broadcast failures
5. Test partial transaction completion scenarios
6. Verify wallet state recovery after failed inscriptions
7. Test concurrent inscription attempts

**Deliverables:**
- Error handling test suite
- Recovery mechanism test suite
- Documentation of error scenarios and recovery procedures
- Recommendations for improving error handling

## Technical Requirements

### Test Environment Setup

1. **Signet Configuration:**
   - Bitcoin Core node connected to Signet
   - Ord server for indexing inscriptions
   - Proper API configuration for Signet network

2. **Test Wallets:**
   - Multiple test wallets with funded UTXOs
   - Different wallet types (hardware, software, etc.)
   - Wallet backup and recovery procedures

3. **Monitoring Tools:**
   - Transaction monitoring dashboard
   - Block explorer for Signet
   - Logging and metrics collection

4. **Automation Framework:**
   - Playwright/Puppeteer setup for UI testing
   - CLI testing framework
   - Continuous integration pipeline
   - Test result reporting dashboard

### Test Data Requirements

1. **Metadata Variations:**
   - Simple key-value pairs
   - Nested JSON structures
   - Various content types (text, JSON, binary)
   - Different metadata sizes (small, medium, large)
   - Special characters and encoding edge cases

2. **Inscription Content:**
   - Text files
   - JSON documents
   - Images (small, medium, large)
   - Combined content and metadata

3. **Network Conditions:**
   - Normal network conditions
   - Simulated network latency
   - Fee rate variations
   - Mempool congestion simulation

## Test Scenarios

### Core Metadata Functionality Tests

1. **Basic Metadata Inscription:**
   - Create a simple text inscription with basic metadata
   - Verify metadata is correctly included in the inscription
   - Confirm inscription is properly indexed and retrievable
   - Implement CLI commands for basic metadata testing

2. **Progressive JSON Metadata Testing:**
   - Start with simple key-value JSON metadata
   - Progress to nested JSON structures
   - Test complex JSON objects with arrays and mixed types
   - Verify all JSON metadata is preserved in the inscription

3. **Verifiable Credentials Metadata:**
   - Create inscriptions with verifiable credential metadata
   - Test different credential formats and schemas
   - Verify credential validation and verification
   - Test credential presentation and selective disclosure

4. **Metadata Size Limits:**
   - Test inscriptions with increasing metadata sizes
   - Determine practical limits for metadata size
   - Verify error handling for oversized metadata

5. **Metadata Encoding:**
   - Test various character encodings in metadata
   - Verify special characters are handled correctly
   - Test binary data in metadata fields

### End-to-End Workflow Tests

1. **Complete Inscription Process:**
   - Select UTXOs for funding
   - Create commit transaction
   - Sign and broadcast commit transaction
   - Create reveal transaction with metadata
   - Sign and broadcast reveal transaction
   - Verify inscription is properly created and indexed

2. **Multi-Inscription Batch:**
   - Create multiple inscriptions in sequence
   - Test parallel inscription creation
   - Verify all inscriptions are properly created and indexed

3. **Recovery from Failures:**
   - Test recovery from failed commit transactions
   - Test recovery from failed reveal transactions
   - Verify wallet state after failed inscriptions

### Integration Testing

1. **API Integration:**
   - Test API endpoints for metadata handling
   - Verify API response formats and error handling
   - Test API rate limiting and concurrency
   - Create CLI commands for API testing

2. **Explorer Integration:**
   - Test explorer UI for displaying metadata using Playwright/Puppeteer
   - Verify metadata search and filtering through automated UI tests
   - Test metadata visualization and formatting
   - Implement screenshot comparison for UI verification

3. **Wallet Integration:**
   - Test wallet integration for signing transactions
   - Verify UTXO selection and management
   - Test fee estimation and transaction building
   - Create CLI commands for wallet interaction testing

4. **Verifiable Credentials Integration:**
   - Test creation and verification of credential metadata
   - Verify credential signatures and validation
   - Test credential revocation and status checking
   - Implement automated verification workflows

## Success Criteria

1. All tests pass consistently on the Signet network
2. Metadata is correctly written to and retrieved from inscriptions
3. Error handling mechanisms work as expected
4. Performance metrics meet acceptable thresholds
5. Documentation is complete and accurate

## Test Reporting

1. **Test Results:**
   - Detailed test results for each test suite
   - Pass/fail status for each test case
   - Error logs and screenshots for failed tests

2. **Coverage Reports:**
   - Code coverage metrics for each package
   - Functionality coverage assessment
   - Gap analysis and recommendations

3. **Performance Metrics:**
   - Transaction confirmation times
   - Fee estimation accuracy
   - Resource utilization metrics
   - API response times

## Immediate Action Plan (Tonight)

### Priority 1: Basic Metadata Writing Test (Next 1-2 Hours)
- Create a simple test script to write basic JSON metadata to Signet
- Focus on the minimal viable test case that proves metadata writing works
- Use existing wallet with funded UTXOs on Signet
- Verify inscription is properly created with metadata

### Priority 2: Metadata Verification (Next 1-2 Hours)
- Create a script to verify metadata was correctly written
- Check that metadata is retrievable and matches what was sent
- Document any issues or inconsistencies

### Priority 3: Quick Test Automation (If Time Permits)
- Create a basic CLI command to automate the metadata writing process
- Focus on making it repeatable for quick iteration

### Critical Tests to Run Tonight
1. **Simple Key-Value Metadata**
   - Write a simple JSON object with 2-3 key-value pairs
   - Verify all fields are preserved in the inscription

2. **Nested JSON Structure**
   - Write a JSON object with nested properties
   - Verify the structure is maintained in the inscription

3. **Special Characters**
   - Include special characters and Unicode in metadata
   - Verify encoding/decoding works correctly

4. **Edge Case: Empty Metadata**
   - Test with empty metadata object
   - Verify handling of this edge case

## Conclusion

This testing initiative will ensure that the Ordinals Plus project can reliably write inscriptions with metadata to the Bitcoin Signet network, paving the way for eventual mainnet deployment. By thoroughly testing this functionality, we can identify and address any issues before they impact users in production.

The focus on metadata writing is critical as it represents a key feature of the Ordinals Plus platform, enabling rich data to be associated with inscriptions. Successful completion of this testing phase will significantly enhance the platform's capabilities and reliability.
