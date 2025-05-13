# UTXO Selection Interface Test Specifications

This file contains test specifications for the UTXO Selection Interface component.
These tests serve as documentation for the functionality that needs to be tested
once the testing environment is properly set up.

Related to **Task 3: Develop UTXO Selection Interface**

## Test Cases

### Test: Should fetch and display available UTXOs

**Steps:**
1. Render the UtxoSelector component with mock wallet context
2. Check if the refresh button is displayed
3. Click the refresh button to fetch UTXOs
4. Verify that the fetchUtxos function is called
5. Verify that UTXOs are displayed with appropriate information:
   - Transaction ID (shortened form)
   - Value in BTC
   - Confirmation status

### Test: Should allow users to select a UTXO

**Steps:**
1. Render the UtxoSelector component with mock UTXOs
2. Find the first UTXO checkbox and select it
3. Verify that the onUtxoSelectionChange function is called with the correct UTXO and selection state
4. Re-render with the selected UTXO in the selectedUtxos array
5. Verify that the selection summary shows the correct count and total value

### Test: Should display relevant UTXO details

**Steps:**
1. Render the UtxoSelector component with mock UTXOs
2. For each UTXO, check:
   - Transaction ID is displayed in shortened form
   - Value is shown in BTC with correct formatting
   - Confirmation status is displayed (Confirmed/Unconfirmed)

### Test: Should provide sorting and filtering options

**Steps:**
1. Render the UtxoSelector component with mock UTXOs
2. Verify sort buttons are present (Value, Age)
3. Verify filter buttons are present (All, Recommended, Confirmed)
4. Click the "Sort by Value" button and verify UTXOs are sorted by value
5. Click the "Confirmed" filter button and verify only confirmed UTXOs are displayed

### Test: Should store the selected UTXO in component state

**Steps:**
1. Render the UtxoSelector with a pre-selected UTXO
2. Verify that the selection summary shows the correct information
3. Verify that the checkbox for the selected UTXO is checked
4. Click the checkbox to deselect the UTXO
5. Verify that the onUtxoSelectionChange function is called with the correct parameters

### Test: Should handle the case of no available UTXOs

**Steps:**
1. Render the UtxoSelector with an empty UTXOs array
2. Verify that a "Load Available UTXOs" button is displayed
3. Click the button and verify that the fetchUtxos function is called

### Test: Should handle UTXOs with insufficient funds

**Steps:**
1. Render the UtxoSelector with a requiredAmount higher than any single UTXO
2. Verify that the guidance message shows the correct required amount
3. Verify that no UTXOs are labeled as "Recommended" since none meet the requirements

### Test: Should display guidance on UTXO selection

**Steps:**
1. Render the UtxoSelector component
2. Verify the guidance section contains appropriate information:
   - Importance of UTXO selection for inscriptions
   - Recommendation to select UTXOs with enough funds
   - Preference for confirmed UTXOs
   - Information about the first input UTXO holding the inscription
3. Verify the required amount is displayed correctly
4. Test the toggle functionality to hide/show guidance

### Test: Should show loading state while fetching UTXOs

**Steps:**
1. Render the UtxoSelector with isFetchingUtxos set to true
2. Verify that a loading indicator is displayed

### Test: Should display error message when UTXO fetch fails

**Steps:**
1. Render the UtxoSelector with a mock error message
2. Verify that the error message is displayed to the user

## Implementation Notes

When implementing these tests, create the following mocks:
1. Mock WalletContext to provide mock UTXOs and wallet functions
2. Mock handler functions (fetchUtxos, utxoSelectionChange)
3. Mock UTXOs with various states (confirmed/unconfirmed, different values)

Key props to test:
- walletConnected: boolean
- utxos: Array of UTXO objects
- selectedUtxos: Array of selected UTXOs
- isFetchingUtxos: boolean
- utxoError: string | null
- flowState: string
- onFetchUtxos: function
- onUtxoSelectionChange: function
- requiredAmount: number

Special test cases:
- Empty UTXOs array
- UTXOs with insufficient funds for required amount
- Mix of confirmed and unconfirmed UTXOs
- Error states (network error, invalid response)
- Loading state 