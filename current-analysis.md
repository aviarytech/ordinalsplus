# Resource Creation Flow Analysis

## Current Architecture Overview

The resource creation process in the Ordinals Plus system is distributed across three main components:

1. **Frontend (ordinals-plus-explorer)**: 
   - Uses `ApiService` to interact with the backend API
   - Handles user input, PSBT signing, and transaction broadcasting
   - Manages UI flow and transaction status monitoring

2. **Backend API (ordinals-plus-api)**:
   - Contains controllers that handle HTTP endpoints
   - Houses services like `psbtService.ts` that construct Bitcoin transactions
   - Manages fee estimation and blockchain interactions

3. **Core Package (ordinalsplus)**:
   - Contains core transaction creation logic
   - Houses utilities for inscription creation
   - Provides types and helper functions used by both frontend and backend

## Key Process Flow

The inscription/resource creation follows this general pattern:

1. **Frontend Collects Data**: User inputs like content, fee rate, recipient address
2. **API Request**: Frontend calls API service to request PSBT creation
3. **PSBT Creation**: Backend constructs commit and reveal PSBTs
4. **PSBT Signing**: Frontend signs the PSBTs with the user's wallet
5. **Transaction Broadcasting**: Signed transactions are sent to the blockchain
6. **Status Monitoring**: Frontend tracks transaction confirmation status

## Identified Duplication and Refactoring Opportunities

### 1. Inscription Script Creation

**Duplication**: 
- The `psbtService.ts` in the API contains custom implementations of inscription script creation
- Similar functionality exists in the core package's `inscription` module

**Refactoring Opportunity**:
- Move all inscription script creation logic to the core package
- Have the API import and use the core package functions directly

### 2. PSBT Creation Logic

**Duplication**:
- The API's `psbtService.ts` has custom implementations for creating commit/reveal PSBTs
- The core package has similar functionality in `transactions/resource-creation.ts` and `transactions/inscription-utils.ts`

**Refactoring Opportunity**:
- Standardize PSBT creation in the core package
- Make the API use these standardized functions

### 3. Fee Calculation

**Duplication**:
- Fee calculation exists in multiple places:
  - API's `feeService.ts`
  - Core package's `transactions/fee-calculation.ts`
  - UI service's own calculations

**Refactoring Opportunity**:
- Centralize all fee calculation logic in the core package
- Ensure consistent fee estimation across the application

### 4. UTXO Selection

**Duplication**:
- UTXO selection logic appears in:
  - API's transaction construction
  - Core package's `transactions/utxo-selection.ts`
  - UI service's payment handling

**Refactoring Opportunity**:
- Create a robust, configurable UTXO selection algorithm in the core package
- Have both API and UI use this centralized implementation

### 5. Network Handling

**Duplication**:
- Network configuration management exists in:
  - API's service layer (with custom network definitions)
  - Core package's utility functions
  - UI service's network handling

**Refactoring Opportunity**:
- Standardize network configuration in the core package
- Create utility functions for consistent network handling

## Recommended Refactoring Approach

1. **Phase 1 - Core Package Enhancement**:
   - Expand the core package to handle all inscription-related functionality
   - Create well-documented, typed APIs for all transaction creation steps
   - Ensure the core package has comprehensive test coverage

2. **Phase 2 - API Service Refactoring**:
   - Refactor the API to use the core package for all Bitcoin transaction handling
   - Slim down services to focus on HTTP concerns rather than Bitcoin logic
   - Maintain backward compatibility for existing API endpoints

3. **Phase 3 - UI Service Alignment**:
   - Update the UI's API service to align with the refactored backend
   - Ensure proper error handling and status tracking
   - Simplify UI logic by leveraging more functionality from the core package

This refactoring will improve maintainability, reduce code duplication, and create a clearer separation of concerns between the three components. The core package should become the single source of truth for all Bitcoin and Ordinals-specific functionality. 