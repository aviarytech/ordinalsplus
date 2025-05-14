## Detailed Implementation Plan for Subtask 4.3: Develop UTXO Selection Algorithm

**Associated Taskmaster Subtask ID:** 4.3

**Date Logged:** $(date +%Y-%m-%d)

**Target Files/Modules:**
*   Primary Logic: `packages/ordinals-plus-api/src/services/bitcoinRpc.ts` (or a new `utxoService.ts` / `walletService.ts`)
*   Tests: `packages/ordinals-plus-api/src/services/__tests__/bitcoinRpc.test.ts` (or equivalent for new service)
*   Documentation: New spec file `packages/ordinals-plus-api/specs/utxo_selection_spec.md` or a section in a general transaction construction spec.

---

### A. Research & Define UTXO Selection Strategy

1.  **Goal:** Select minimal UTXO(s) to cover inscription cost (content, metadata, transaction overhead) plus fees, minimizing dust and change if possible.
2.  **Inputs to Algorithm:**
    *   `inscriptionContentSize`: Estimated size of inscription content (bytes).
    *   `inscriptionMetadataSize`: Estimated size of CBOR metadata (bytes, from `getEncodedMetadataSize`).
    *   `desiredFeeRate`: Target fee rate in sats/vByte (can be dynamic or fixed input).
    *   `availableUtxos`: Array of `{ txid, vout, value_sats, scriptPubKey_hex }`.
    *   `recipientAddress`: Address for the inscription output.
    *   `changeAddress`: Address for the change output.
    *   `cardinalDustValue`: Minimum value for the inscription output itself (e.g., 546 sats for P2TR).
3.  **Transaction Size Estimation (Details in separate spec/documentation):
    *   Account for version, locktime, inputs (P2TR key-path for funding, P2TR script-path for inscription), outputs (P2TR inscription, P2TR change).
    *   Critically, estimate witness size for the inscription input based on content/metadata sizes (using `transaction_structure_spec.md`).
4.  **Fee Calculation:** `totalTxVBytes * desiredFeeRate`.
5.  **Algorithm Outline (Greedy Approach):
    *   Initialize `selectedUtxos = []`, `currentTotalValue = 0`, `estimatedTxVBytes = estimateBaseTxSize() + estimateInscriptionOutputSize() + estimateChangeOutputSize()`.
    *   **Funding Loop (Iterative):**
        *   `cost = cardinalDustValue + (estimatedTxVBytes * desiredFeeRate)`.
        *   If `currentTotalValue < cost`:
            *   Select the smallest available UTXO from `availableUtxos` that, when added, helps meet the `cost` without grossly overshooting (or a more sophisticated selection if needed, e.g., if no single UTXO is enough, combine smallest).
            *   If no suitable UTXO found, throw `InsufficientFundsError`.
            *   Add selected UTXO to `selectedUtxos`, update `currentTotalValue`, add `estimateP2TRInputSize()` to `estimatedTxVBytes`.
            *   Repeat funding loop.
    *   **Post-Loop:**
        *   `finalFee = estimatedTxVBytes * desiredFeeRate`.
        *   `changeValue = currentTotalValue - cardinalDustValue - finalFee`.
        *   If `changeValue < DUST_THRESHOLD_P2TR` (e.g., 546 sats), then `changeValue = 0` and recalculate `finalFee = currentTotalValue - cardinalDustValue`. The fee effectively absorbs the small change.
        *   If after absorbing change, `finalFee` results in a fee rate much lower than desired, or if `currentTotalValue < cardinalDustValue + (estimatedTxVBytes * desiredFeeRate_after_absorbing_change)`, it might indicate a need to add more fees or a different UTXO selection. This part needs refinement (e.g. if fee becomes too low, either accept it or try to add a tiny UTXO to bump fee, or fail if strict fee rate is required).
6.  **Cardinal UTXO:** The current plan assumes the inscription output is a new output with `cardinalDustValue`. If an *existing* UTXO is to be inscribed, the logic changes: that UTXO is the first input, and its value contributes to `currentTotalValue`. Its script path spend witness size will be larger.

### B. Dynamic Fee Estimation (Integration or Parameter)

1.  **Option 1 (Preferred if feasible):** Integrate with a fee rate provider API (e.g., mempool.space) or use `bitcoinNode.estimateSmartFee()` if `bitcoinRpc.ts` wraps a node connection.
2.  **Option 2 (Fallback):** The main selection function accepts `desiredFeeRate` as a mandatory parameter.
3.  The subtask implies implementation, so Option 1 is the target. This might involve a new helper `async getDynamicFeeRate(confirmationTarget: number): Promise<number>`. 

### C. Implement `selectUtxosAndCalculateFees` (in `bitcoinRpc.ts` or new service)

1.  **Function Signature (example using Option 2 for fee rate input initially for simplicity, dynamic fetch can be added later):
    ```typescript
    interface Utxo { txid: string; vout: number; value: number; scriptPubKey?: string; address?: string; }
    interface TxOutput { address?: string; script?: Buffer; value: number; }
    interface SelectedUtxosResult {
      inputs: Utxo[];
      outputs: TxOutput[];
      fee: number; // Calculated total fee in satoshis
      estimatedTxVBytes: number;
      changeUsed: boolean;
    }

    async function selectUtxosAndCalculateFees({
      availableUtxos,
      inscriptionContentSize,
      inscriptionMetadataSize,
      recipientAddress, // for the inscription output
      changeAddress,    // for the change output
      desiredFeeRate,   // sats/vByte
      cardinalOutputValue = 546, // Default P2TR dust for new inscription output
      minChangeValue = 546 // Dust threshold for change
    }: { /* params */ }): Promise<SelectedUtxosResult>;
    ```
2.  **Logic:** Follow algorithm from A.5. Handle errors like insufficient funds.

### D. Transaction Size Calculation Utilities

1.  Create helper functions (e.g., in `packages/ordinals-plus-api/src/utils/txSizeEstimator.ts`):
    *   `estimateP2TRInputVBytes(isScriptPath: boolean, witnessScriptLength?: number): number`
    *   `estimateP2TROutputVBytes(): number`
    *   `estimateBaseTxVBytes(numInputs: number, numOutputs: number): number` (overhead: version, locktime, input/output counts)
    *   `estimateWitnessVBytes(witnessItems: Buffer[]): number`
2.  Base these on Bitcoin Core logic or well-known constants (e.g., input ~68vBytes for key path, output ~31vBytes for P2TR).
    *   Input (P2TR key path): ~57.5 vBytes (Older estimate) or closer to `(32+4+1+72+4)/4 + 10 = 27.75 + 10 = 37.75 + 41 = 78.75` -> Taproot input: 1 UTXO ID (36 bytes) + 1 sequence (4 bytes) + 1 scriptSig (1 byte of 0) + 1 witness count (1 byte) + 1 witness item (64-byte signature) = 106 WU / 4 = 26.5 vB. This calculation needs care. `bitcoinjs-lib` `Transaction.virtualSize()` is a good reference.
    *   P2TR output: ~43 vBytes. scriptPubKey (1 byte OP_1, 1 byte push 32, 32 byte pubkey), value (8 bytes) = 42 bytes. bitcoinjs-lib uses ~31vB for P2TR output.
    *   Base (no inputs/outputs): 10-12 vBytes.

### E. Unit Tests

1.  For `selectUtxosAndCalculateFees`:
    *   Cases: single UTXO, multiple UTXOs, exact change, no change, change absorbed into fee, insufficient funds.
    *   Vary fee rates, content/metadata sizes.
2.  For `txSizeEstimator.ts` functions: Compare against known values or `bitcoinjs-lib` results.
3.  Mock `availableUtxos` and any dynamic fee provider.

### F. Documentation

1.  Create `packages/ordinals-plus-api/specs/utxo_selection_spec.md` detailing the algorithm, fee logic, and size estimations.
2.  Add JSDoc to all new public functions.

---
This plan provides a structured approach to developing the UTXO selection and fee calculation logic. 