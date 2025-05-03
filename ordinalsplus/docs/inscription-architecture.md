# Ordinals Inscription Architecture

This document provides an overview of the enhanced ordinals inscription architecture, which follows the micro-ordinals approach with cleaner code structure and better type definitions.

## System Overview

The inscription system is designed around a two-transaction approach:

1. **Commit Transaction**: Creates an output at a commit address that will be used as an input for the reveal transaction
2. **Reveal Transaction**: Includes the inscription data and reveals it on the blockchain

The implementation provides a clean, typed, and maintainable interface to this process, abstracting away the complexity of Bitcoin script generation and transaction handling.

## Core Components

### InscriptionOrchestrator

The central coordinator that manages the entire inscription flow. It follows an event-driven design and provides methods for:

- Content preparation
- UTXO selection
- Fee calculation
- Commit transaction execution
- Reveal transaction execution

The orchestrator maintains the state of the inscription process and emits events for each step, allowing UI components to react to state changes.

### Content Preparation

Handles the processing of different content types (text, JSON, images) with proper MIME type handling. It validates content against size limits and supported formats.

### P2TR Key Generation

Manages the creation of Pay-to-Taproot (P2TR) addresses and keys needed for the inscription process. This includes:

- Generating taproot key pairs
- Deriving P2TR addresses from internal keys
- Converting between different key formats

### Inscription Script Generation

Creates the Bitcoin scripts necessary for embedding content on the blockchain following the ordinals protocol. It handles:

- Content encoding
- Protocol marker insertion
- Script structure creation

### Transaction Management

Split into two main classes:

1. **CommitTransaction**: Handles the creation and sending of the commit transaction
2. **RevealTransaction**: Handles the creation and sending of the reveal transaction

### Transaction Status Tracking

Provides tracking and status updates for both commit and reveal transactions. Features include:

- Transaction status changes
- Confirmation counting
- Block explorer links
- Progress event tracking
- Parent-child transaction relationships

### Fee Calculation

Estimates transaction fees based on:

- Content size
- Transaction structure
- Current fee rates

## Error Handling System

The architecture includes a comprehensive error handling system that:

- Classifies errors into categories (network, wallet, validation, system)
- Provides user-friendly error messages
- Supports error recovery paths
- Includes structured error logging

## Event Flow

1. User selects content to inscribe
2. Content is prepared and validated
3. User selects a UTXO for the inscription
4. System calculates required fees
5. User confirms and initiates the commit transaction
6. System tracks commit transaction status
7. Once confirmed, system executes the reveal transaction
8. System tracks reveal transaction status and provides updates

## Testing Strategy

The architecture includes:

1. **Unit Tests**: For individual components
2. **Integration Tests**: For the complete inscription flow
3. **Performance Tests**: For measuring system performance with different content types and sizes

## Design Decisions

- **Event-driven architecture**: Allows for loose coupling between components
- **Singleton instances**: Ensures consistent state throughout the application
- **Typed interfaces**: Provides compile-time safety and better developer experience
- **Error classification**: Makes error handling more structured and user-friendly
- **Mock implementations**: Facilitates testing without requiring actual blockchain interactions

## Future Enhancements

- Support for more complex inscription types
- Batched inscriptions for efficiency
- Enhanced fee estimation algorithms
- More detailed transaction status tracking
- Support for additional wallet providers

## Usage Example

```typescript
// Create the orchestrator (or use the singleton instance)
const orchestrator = inscriptionOrchestrator;

// Prepare content
await orchestrator.prepareContent('Hello, Ordinals!', 'text/plain');

// Select UTXO
orchestrator.selectUTXO(selectedUtxo);

// Calculate fees
const fees = await orchestrator.calculateFees(feeRate);

// Execute commit transaction
const commitTxid = await orchestrator.executeCommitTransaction();

// Wait for commit transaction confirmation
// ...

// Execute reveal transaction
const revealTxid = await orchestrator.executeRevealTransaction();

// Track transaction status
const status = transactionTracker.getTransaction(revealTxid);
``` 