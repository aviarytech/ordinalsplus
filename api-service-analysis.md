# API Service Implementation Analysis

## API Architecture Overview

The ordinals-plus system uses a client-server architecture with:

1. **Frontend (Explorer)**: Located in `ordinals-plus-explorer/`, using an `ApiService` class to communicate with the API
2. **Backend API**: Located in `ordinals-plus-api/`, built with Elysia.js, handling requests and processing Bitcoin/ordinals data

## Key Components

### Backend (API Server)

1. **Controllers Layer**:
   - `inscriptionsController.ts`: Handles inscription-related operations like creating PSBTs and fetching transaction status
   - Other controllers for resources, exploration, and linked resources

2. **Service Layer**:
   - `psbtService.ts`: Core service for creating Bitcoin PSBTs (Partially Signed Bitcoin Transactions) needed for inscription creation
   - `feeService.ts`: Handles fee estimations for transactions
   - `blockchainService.ts`: Manages blockchain interactions like transaction status

3. **Routes** (defined in `index.ts`):
   - The API uses Elysia.js for routing, with endpoints like:
     - `/api/inscriptions/commit`: Creates PSBTs needed for inscriptions
     - `/api/transactions/broadcast`: Broadcasts signed transactions
     - `/api/addresses/:address/utxos`: Fetches UTXOs for an address
     - `/fees/estimate`: Provides fee estimates
     - Various resource/inscription query endpoints

### Frontend API Service

The frontend's `ApiService` class (`ordinals-plus-explorer/src/services/apiService.ts`) is a comprehensive client for interacting with the backend:

1. **Core Structure**:
   - Wraps all API calls in methods with strong typing
   - Handles common response processing through `handleApiResponse<T>` 
   - Supports multiple networks (`mainnet`, `signet`, `testnet`)

2. **Key Features**:
   - Creating inscription PSBTs (including special commit/reveal transaction pairs)
   - Transaction broadcasting and status tracking
   - Fee estimation
   - UTXO management for addresses
   - Resource and inscription data retrieval

## Inscription Flow

The ordinals inscription process is particularly important and uses a special commit/reveal transaction pattern:

1. **Commit Transaction**: 
   - Created by the API's `/api/inscriptions/commit` endpoint
   - Takes UTXOs, content, and fee parameters
   - Creates a P2TR (Pay-to-Taproot) output containing the inscription data

2. **Reveal Transaction**:
   - Uses TapScript to reveal the inscription content
   - Requires special signing with the provided `revealSignerWif` key
   - Sends the inscription to the recipient address

This two-phase transaction approach is required by the Ordinals protocol for embedding data in Bitcoin transactions.

## Connection Points

The frontend and backend are connected through RESTful API calls with:

1. **Request/Response Types**: 
   - Shared typings like `CreateCommitRequest`, `FeeEstimateResponse`, `Utxo`, etc.
   - Standardized error handling format

2. **Network Selection**:
   - API supports multiple Bitcoin networks (mainnet, signet, testnet)
   - Network type is passed in most requests

3. **Authentication**:
   - Currently no authentication mechanism is visible, suggesting this is either a public API or will have auth added later

The system uses Bitcoin.js for transaction handling and supports advanced features like TapScript and Ordinals inscription creation within a carefully designed, type-safe architecture. 