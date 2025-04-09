## Product Requirements Document: Ordinals Plus Creation Tools

**1. Executive Summary**

This document outlines the requirements for adding creation tools to the Ordinals Plus Explorer. This new functionality will empower users to inscribe standard Bitcoin Ordinals, create Ordinals Plus Decentralized Identifiers (`did:btco`), and link resources to existing DIDs directly within the explorer interface. This enhancement aims to transform the explorer from a purely read-only tool into an interactive platform for participating in the Ordinals and Ordinals Plus ecosystem, leveraging the existing backend infrastructure (`ordinals-plus-api`) and core library (`ordinalsplus`).

**2. Product Vision**

To provide a seamless, user-friendly interface within the Ordinals Plus Explorer for creating and managing Bitcoin Ordinals, `did:btco` identifiers, and their associated linked resources, thereby lowering the barrier to entry for users wishing to establish and enrich their on-chain identity and data using the Ordinals protocol.

**3. Target Users**

*   **Existing Ordinals Plus Explorer Users**: Individuals currently browsing DIDs and resources who wish to create their own.
*   **Developers**: Building applications or services leveraging Ordinals Plus DIDs who need a simple way to create test or production DIDs/resources.
*   **Creators/Individuals**: Users wanting to establish a decentralized identity on Bitcoin via `did:btco` or inscribe digital artifacts as standard Ordinals.

**4. User Stories/Use Cases**

*   **UC-1 (Generic Ordinal)**: As a user, I want to inscribe arbitrary data (e.g., text, JSON, potentially images) onto Bitcoin as a standard Ordinal, so that I can own a unique on-chain digital artifact.
*   **UC-2 (DID Creation)**: As a user, I want to create a new `did:btco` identifier by inscribing specific data following the Ordinals Plus DID specification, so that I can establish my decentralized identity on the Bitcoin blockchain.
*   **UC-3 (Linked Resource Creation)**: As a user who owns a `did:btco`, I want to inscribe new data (e.g., profile information, credentials, links) and associate it with my existing DID according to the Ordinals Plus specification, so that I can add verifiable information and resources to my decentralized identity.

**5. Functional Requirements**

*   **FR-1: Creation Interface Selection**: The UI must provide a clear way for users to choose between the three creation types: Generic Ordinal, DID Creation, or Linked Resource Creation (e.g., using tabs or distinct pages). This will likely reside in a new section of the `ordinals-plus-explorer`.
*   **FR-2: Generic Ordinal Creation Form**:
    *   Input field for content type (e.g., `text/plain`, `application/json`).
    *   Input field (e.g., `<textarea>`) for content data. (Consider support for file uploads in a future iteration).
    *   Mechanism to display estimated network fees.
    *   Submit action to initiate the inscription process via `ordinals-plus-api`.
*   **FR-3: DID Creation Form**:
    *   Minimal form, as DID creation primarily involves inscribing specific marker data. May include optional fields if the spec allows.
    *   Mechanism to display estimated network fees.
    *   Submit action to initiate the DID inscription process via `ordinals-plus-api`, ensuring adherence to the `did:btco` format likely defined in `ordinalsplus`.
*   **FR-4: Linked Resource Creation Form**:
    *   Input field to specify the parent `did:btco` URI to link the resource to. Should include validation.
    *   Input field for resource content type.
    *   Input field for resource content data.
    *   Mechanism to display estimated network fees.
    *   Submit action to initiate the resource inscription process via `ordinals-plus-api`, ensuring correct association with the parent DID.
*   **FR-5: Input Validation**: All forms must implement client-side and server-side validation for required fields, data formats (e.g., valid DID URI), and potentially content size limits.
*   **FR-6: Transaction Handling (API - `ordinals-plus-api`)**:
    *   New API endpoints corresponding to each creation type (Generic, DID, Resource).
    *   Endpoints must receive creation parameters, construct the appropriate inscription data (potentially using utilities from `ordinalsplus`), and prepare the Bitcoin transaction.
    *   **Requires Wallet Interaction (See Open Issues)**: The API needs a defined mechanism to get the transaction signed and broadcasted. This might involve:
        *   Returning unsigned transaction data (PSBT) for the user to sign with a browser extension/external wallet.
        *   Integrating with a backend wallet service managed by the API (less decentralized, requires careful security).
        *   *Assumption*: The initial implementation will likely favor returning an unsigned transaction (PSBT) to the frontend.
*   **FR-7: Transaction Status Feedback (UI - `ordinals-plus-explorer`)**:
    *   Display clear feedback to the user regarding the transaction status: pending broadcast, pending confirmation (with link to mempool explorer), confirmed (with link to inscription on explorer), or failed (with error details).
    *   Leverage existing API services (`ordinals-plus-api`, potentially Ordiscan integration) to monitor status.
*   **FR-8: Post-Creation**: Upon successful confirmation, provide a direct link to view the newly created Ordinal, DID, or Resource within the `ordinals-plus-explorer`. Ensure relevant explorer views (`DidExplorer`, `LinkedResourceViewer`) are updated or can be easily refreshed to show the new item.

**6. Technical Requirements**

*   **TR-1 (Frontend - `ordinals-plus-explorer`)**:
    *   Implement new React functional components for the creation forms/pages.
    *   Utilize TypeScript for all new code, defining interfaces (in `/src/types/`) for form state and API payloads/responses.
    *   Strict adherence to Tailwind CSS for all styling, including dark mode support (`dark:` prefixes). No custom CSS files or CSS-in-JS.
    *   Use `lucide-react` for all icons.
    *   Integrate with the new creation endpoints in `ordinals-plus-api` (via `/src/services/`).
    *   Implement robust state management for form data, API call lifecycle (loading, success, error), and transaction monitoring.
    *   Handle potential PSBT signing flow if that wallet interaction model is chosen.
*   **TR-2 (Backend - `ordinals-plus-api`)**:
    *   Develop new Elysia.js routes/controllers for handling creation requests.
    *   Integrate a Bitcoin library (e.g., `bitcoinjs-lib`) for transaction construction (creating PSBTs).
    *   Utilize shared types and validation logic from the `ordinalsplus` library where applicable (e.g., validating DID format, constructing specific inscription data).
    *   Interact with a Bitcoin Core node or trusted API (like Ordiscan or Mempool.space) for fee estimation and potentially broadcasting signed transactions (depending on wallet model).
    *   Implement API endpoint for checking transaction confirmation status.
*   **TR-3 (Core Library - `ordinalsplus`)**:
    *   Review and potentially add/update TypeScript types/interfaces related to DID/Resource inscription structure if needed.
    *   May include utility functions for constructing or validating inscription data specific to the `did:btco` specification.

**7. System Architecture**

1.  **User Interaction (Explorer)**: User selects creation type, fills form in `ordinals-plus-explorer`.
2.  **API Request (Explorer -> API)**: Frontend sends validated form data to the relevant endpoint on `ordinals-plus-api`.
3.  **Transaction Construction (API)**: `ordinals-plus-api` constructs the inscription data (using `ordinalsplus` logic if needed) and prepares an unsigned Bitcoin transaction (PSBT).
4.  **Signing (User/Wallet)**:
    *   *Scenario A (PSBT)*: API returns PSBT to the frontend. Frontend prompts user to sign with connected wallet (e.g., browser extension). Signed transaction is sent back to API or broadcast directly by wallet.
    *   *Scenario B (API Wallet)*: API signs transaction using its managed wallet (Requires secure key management).
5.  **Broadcasting (API/Wallet)**: The signed transaction is broadcast to the Bitcoin network via `ord` node or similar service. API returns transaction ID to frontend.
6.  **Status Monitoring (Explorer/API)**: Frontend periodically polls an API endpoint (or uses WebSockets if implemented) which checks the transaction status using the Ord node or Ordiscan.
7.  **UI Update (Explorer)**: Frontend updates UI to reflect transaction status (pending, confirmed, failed) and provides links upon confirmation.

**8. UI/UX Requirements**

*   **UX-1**: Creation tools should be easily discoverable within the explorer navigation.
*   **UX-2**: Use clear, concise language for form labels, instructions, and feedback messages.
*   **UX-3**: Follow existing design language: Tailwind utilities, dark mode support (`dark:`), blue/indigo gradient headers for sections, card-based layouts where appropriate (e.g., displaying created item preview), subtle shadows, rounded corners. Use pill styles for any selectable options (like content type presets).
*   **UX-4**: Implement loading states (e.g., spinners, disabled buttons) during API calls and transaction processing. Use `lucide-react` icons for visual cues.
*   **UX-5**: Provide non-intrusive, clear success and error notifications (e.g., toasts).
*   **UX-6**: Ensure responsive design for usability across different screen sizes.
*   **UX-7**: Display estimated fees clearly before the user commits to signing/broadcasting.

**9. Performance Requirements**

*   **PERF-1**: API response time for initial creation request (returning PSBT or confirmation of broadcast) should be under 2 seconds.
*   **PERF-2**: UI should remain responsive during background polling for transaction status.
*   **PERF-3**: Form validation should feel instantaneous.

**10. Security Requirements**

*   **SEC-1**: Implement standard input sanitization and output encoding on both frontend and backend to prevent XSS and other injection attacks.
*   **SEC-2**: If a PSBT model is used, the API never handles private keys. Responsibility lies with the user's wallet.
*   **SEC-3**: If an API-managed wallet model is chosen (discouraged for decentralization), extremely robust key management and protection measures are required for the `ordinals-plus-api` service.
*   **SEC-4**: Protect API endpoints against abuse (rate limiting, authentication if applicable beyond just transaction signing).

**11. Compliance Requirements**

*   **COMP-1**: Generated inscriptions must strictly adhere to the standard Ordinals protocol.
*   **COMP-2**: DID and Linked Resource inscriptions must conform to the latest `did:btco` specification defined/used by the `ordinalsplus` project.

**12. Testing Requirements**

*   **TEST-1**: Unit tests for form validation logic, API client functions (`ordinals-plus-explorer`).
*   **TEST-2**: Unit and Integration tests for API endpoints: request validation, transaction construction logic, interaction with Bitcoin node/libraries (using mocks or testnet), `ordinalsplus` library usage (`ordinals-plus-api`).
*   **TEST-3**: End-to-end tests simulating the full creation flow on a Bitcoin testnet (Regtest or Testnet3): filling form, signing (requires mock wallet or test framework integration), broadcasting, verifying inscription appears in explorer.
*   **TEST-4**: UI component testing for rendering, state changes, and user interactions.

**13. Deployment Considerations**

*   **DEP-1**: `ordinalsplus` library may need a version bump and publishing if changes are made.
*   **DEP-2**: `ordinals-plus-api` service requires deployment with updated code and potentially new environment variables (e.g., Bitcoin node connection details, fee estimation service URLs). Requires access to a running, synced Bitcoin node (`ord` compatible).
*   **DEP-3**: `ordinals-plus-explorer` requires standard build and deployment of the updated React application.

**14. Success Metrics**

*   **MET-1**: Number of successful inscriptions initiated via the tool (tracked per type: Generic, DID, Resource).
*   **MET-2**: User engagement rate with the creation feature (e.g., % of active users who attempt creation).
*   **MET-3**: Task success rate (percentage of users starting a creation flow who successfully broadcast a transaction).
*   **MET-4**: User feedback collected via surveys or feedback forms regarding ease of use and functionality.

**15. Timeline and Milestones**

*   *To Be Determined (TBD)* - Requires estimation based on development resources.
*   **M1**: API Endpoints & Logic (Transaction construction, fee estimation, status check).
*   **M2**: `ordinalsplus` Library Updates (If required).
*   **M3**: Frontend UI Components (Forms for each creation type).
*   **M4**: Frontend API Integration & State Management.
*   **M5**: Wallet Integration (PSBT signing flow or alternative).
*   **M6**: Testing (Unit, Integration, E2E on Testnet).
*   **M7**: Deployment.

**16. Open Issues/Questions**

*   **OIQ-1 (Critical): Wallet Interaction Model**: How will users sign and pay for inscription transactions?
    *   Option A: Frontend receives PSBT from API, user signs with browser extension (e.g., Leather, Xverse, UniSat). Frontend sends signed TX back to API for broadcast, or wallet broadcasts directly. (Preferred for decentralization).
    *   Option B: API integrates with a backend wallet service. (Requires significant security considerations).
    *   Option C: User manually copies PSBT, signs with external tool, pastes signed TX back. (Poor UX).
*   **OIQ-2: Fee Estimation Strategy**: How will fees be estimated (e.g., API call to node, external service)? How will fee levels (low, medium, high) be presented?
*   **OIQ-3: Content Type Support**: What initial set of content types will be explicitly supported in the UI (e.g., `text/plain`, `application/json`)? Will file uploads be supported for content data in the first version?
*   **OIQ-4: Error Handling Details**: Define specific user-facing messages for common errors (insufficient funds (if detectable), invalid DID format, connection issues, broadcast failures, etc.).
*   **OIQ-5: Mainnet/Testnet**: Will the tool initially target Testnet/Regtest or Mainnet? Needs configuration options in API and potentially UI.

---

This PRD provides a comprehensive starting point based on the information available. The most critical next step is resolving **OIQ-1 (Wallet Interaction Model)**, as it significantly impacts the architecture and user experience.
