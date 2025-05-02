# Product Requirements Document: Enhanced Ordinals Inscription Flow

## Purpose
Enhance the inscription process by incorporating elements from the micro-ordinals
example, specifically allowing users to select which UTXO will be included as the
first input in the inscription transaction while maintaining the two-transaction
(commit + reveal) approach with a cleaner implementation.

## Current Implementation Status
The current ResourceCreationForm implementation uses a complex two-transaction
approach (commit + reveal) that is only partially complete and combines elements
from different inscription methodologies. This "Frankenstein" implementation:

- Uses an overly complex process for managing commit and reveal transactions
- Contains significant unused/unnecessary code
- Has multiple error-prone steps in the inscription flow
- Includes convoluted state management for handling commit confirmations
- Contains type errors in the API integration
- Doesn't properly incorporate UTXO selection for the first input

Implementing the enhanced approach based on the micro-ordinals example will require
significant refactoring while keeping the two-transaction flow, but with a much
cleaner reveal process and proper UTXO selection.

## User Stories
- As a user, I want to select specific UTXOs to be used as the first input in my inscription
- As a user, I want a clearer and more reliable commit-reveal process
- As a user, I want to see real-time fee estimates before committing to a transaction
- As a user, I want to track the status of my inscription transactions

## Acceptance Criteria
1. User can specify content type and content for inscription
2. System generates a commit address for receiving funds
3. User can view and select from available UTXOs to use as the first input
4. System calculates required amount (inscription size + fee)
5. User can send Bitcoin to the commit address
6. System tracks the commit transaction and prepares the reveal transaction
7. The reveal transaction incorporates the selected UTXO as the first input
8. User can see transaction ID, vsize, and estimated fee
9. Interface shows confirmation when transactions are successfully broadcast
10. Transaction details are displayed with links to block explorer

## Technical Requirements
1. Implement `ordinals.p2tr_ord_reveal` to generate proper inscription scripts
2. Allow user selection of which UTXO will be the first input in the transaction
3. Maintain the commit-reveal flow but with cleaner code based on micro-ordinals
4. Add proper fee calculation based on transaction vsize
5. Support various content types (text, JSON, images)
6. Include error handling for failed transactions
7. Improve the UTXO selection interface showing available amounts
8. Display clear progress indicators throughout the process
9. Clean up commit-transaction related code to be more maintainable
10. Simplify state management while maintaining the two-transaction flow
11. Fix type definitions to match the micro-ordinals library interface
12. Thoroughly clean up unused variables, functions, and imports
13. Ensure code maintainability through proper documentation

## Risks
1. Users might not understand which UTXO to select for inscription
2. Transaction might fail if fee estimates are inaccurate
3. Large inscriptions may require multiple UTXOs or special handling
4. Selected UTXO might be spent before the transaction is finalized
5. Maintaining the two-transaction approach still has inherent complexity
6. Integrating the micro-ordinals approach while keeping commit-reveal flow may be challenging
7. Significant refactoring may introduce new bugs in the process
8. UI flow changes may confuse users familiar with the current process

## Implementation Priority
High - This enhancement will improve user experience by providing more control
over the inscription process while cleaning up the codebase significantly.
The implementation will be more reliable and maintainable while still following
the commit-reveal pattern that's standard for ordinals inscriptions.
