# Verifiable Credential Wallet Information

## Bitcoin Core Wallet Details
- **Wallet Name**: verifiable_credential_wallet
- **Network**: Signet
- **Purpose**: For creating Verifiable credential on Cygnet network

## Bitcoin Core Addresses
- **Verifiable Credential Address**: tb1qtya4axfnyymhzymfqhmmne5556huud0un05gmy
  - **Label**: verifiable_credential
  - **Type**: bech32 (Native SegWit)
  - **Created**: 2025-05-18

## Ordinals Wallet Details
- **Data Directory**: `./data/signet/verifiable_credential_wallet`
- **Network**: Signet
- **Purpose**: For inscribing Verifiable credential on Cygnet network
- **Mnemonic**: `obscure vapor guess virtual awkward plunge text onion gospel seed guess around`
  - ⚠️ **IMPORTANT**: Keep this mnemonic secure. It's needed to recover the wallet.

## Ordinals Addresses
- **Receiving Address**: tb1phnzzj2ylzxmdhh88ftaa3dqxfyz0ut6fj3epu59a4t6whhr7384s6rl9ty
  - **Type**: Taproot (P2TR)
  - **Created**: 2025-05-19

## Funding
To fund this wallet, you can use one of the following Signet faucets:
- [Signet Faucet](https://signet.bc-2.jp/)
- [Alternative Signet Faucet](https://signetfaucet.com/)

## Bitcoin Core Commands
Common commands for managing the Bitcoin Core wallet:

```bash
# Check wallet balance
./scripts/bitcoin-cli-signet.sh -rpcwallet=verifiable_credential_wallet getbalance

# List transactions
./scripts/bitcoin-cli-signet.sh -rpcwallet=verifiable_credential_wallet listtransactions

# Get a new address
./scripts/bitcoin-cli-signet.sh -rpcwallet=verifiable_credential_wallet getnewaddress "label" "bech32"

# Send transaction
./scripts/bitcoin-cli-signet.sh -rpcwallet=verifiable_credential_wallet sendtoaddress "address" amount
```

## Ordinals Commands
Common commands for managing the Ordinals wallet:

```bash
# Using the helper script
./scripts/ord-wallet-signet.sh balance  # Check wallet balance
./scripts/ord-wallet-signet.sh outputs  # List unspent outputs
./scripts/ord-wallet-signet.sh receive  # Get receiving address

# Create an inscription
./scripts/ord-wallet-signet.sh inscribe --fee-rate 1 <path-to-file>

# Send an inscription
./scripts/ord-wallet-signet.sh send <inscription-id> <address>
```

## Notes
- Signet coins have no real value and are only for testing
- The wallet data is stored in the Bitcoin Core data directory configured in bitcoin.conf
