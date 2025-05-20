# Product Requirements Document: Multi-Step Resource Inscription Workflow

## Overview
The current ResourceCreationForm is too large and complex, making it difficult to maintain and extend. This PRD outlines a restructuring of the form into a multi-step workflow with distinct sub-components, each handling a specific part of the resource inscription process.

## Goals
- Break down the monolithic ResourceCreationForm into smaller, focused components
- Implement a clear step-by-step workflow for resource inscription
- Support both standard inscriptions and verifiable credential inscriptions
- Improve code maintainability and readability
- Enhance user experience with a guided workflow

## Architecture

### Main Component
- `ResourceInscriptionWizard`: Container component that manages the overall state and workflow

### Sub-Components
1. `UTXOSelectionStep`: For selecting UTXOs to inscribe onto
2. `ContentSelectionStep`: For selecting/uploading content or entering text
3. `MetadataStep`: For entering metadata, with special handling for verifiable credentials
4. `TransactionStep`: For handling the commit and reveal transactions

### Shared State
The main component will maintain shared state accessible to all sub-components, including:
- Current step
- UTXO selection
- Content data
- Metadata
- Transaction information
- Workflow status

## Detailed Workflow

### Step 1: UTXO Selection
**Component: `UTXOSelectionStep`**
- Display available UTXOs from the user's wallet
- Allow selection of one or more UTXOs
- Show UTXO details (value, confirmation status)
- Validate selection based on minimum required value
- Navigation controls to proceed to next step

### Step 2: Content Selection
**Component: `ContentSelectionStep`**
- Provide file upload functionality with drag-and-drop support
- Support direct text input for text-based inscriptions
- Display file preview when applicable
- Content type selection
- File validation (size, type)
- Navigation controls to move forward/backward

### Step 3: Metadata Entry
**Component: `MetadataStep`**
- Standard metadata entry fields (name, description, etc.)
- Toggle between standard metadata and verifiable credential
- For verifiable credentials:
  1. VC API Provider selection dropdown
  2. Dynamic form generation based on provider requirements
  3. API integration to query provider for required exchange variables
  4. Form fields for entering required variables
  5. Exchange creation and participation
  6. Display of issued credential
- Validation of metadata format
- Navigation controls to move forward/backward

### Step 4: Transaction Processing
**Component: `TransactionStep`**
- Display transaction details (fees, amounts)
- Commit transaction preparation and signing
- Transaction broadcast status
- Reveal transaction preparation and signing
- Confirmation status tracking
- Success/failure handling
- Option to start over or create another inscription

## Technical Implementation Details

### State Management
- Use React Context for global state accessible to all components
- Each sub-component can access and update relevant parts of the state
- Use reducers for complex state transitions

### Component Structure
```
ResourceInscriptionWizard/
├── StepIndicator
├── UTXOSelectionStep
├── ContentSelectionStep
├── MetadataStep
├── TransactionStep
└── shared/
    ├── ErrorDisplay
    ├── LoadingIndicator
    └── NavigationControls
```

### API Integration
- Integrate with wallet API for UTXO management
- Connect with VC API providers for credential issuance
- Use inscription API for transaction creation and broadcasting

### Error Handling
- Implement comprehensive error handling at each step
- Provide clear error messages and recovery options
- Maintain error state for each step independently

## Verifiable Credential Workflow

The verifiable credential workflow within the Metadata step will follow this process:

1. User selects "Verifiable Credential" option
2. User selects a VC API Provider from dropdown
3. System queries the provider API for required exchange variables
4. Dynamic form is generated based on required variables
5. User enters the required information
6. On submission, system creates an exchange with the provider
7. System participates in the exchange to receive the issued credential
8. Issued credential is displayed and stored in the metadata

## User Experience Considerations

- Clear step indicators showing progress through the workflow
- Ability to navigate back to previous steps to make changes
- Validation feedback at each step
- Loading indicators during API calls and processing
- Comprehensive error messages with recovery options
- Success confirmation with transaction details
- Mobile-responsive design for all steps

## Implementation Plan

1. Create the base ResourceInscriptionWizard component with step management
2. Implement the StepIndicator component
3. Build each step component individually, starting with the simplest (UTXOSelectionStep)
4. Implement shared state management
5. Add navigation between steps
6. Integrate API calls for each step
7. Implement error handling and validation
8. Add the verifiable credential workflow to the MetadataStep
9. Test the complete workflow end-to-end
10. Optimize for performance and user experience

This modular approach will make the code more maintainable, easier to test, and provide a better user experience with a clear step-by-step process for resource inscription.
