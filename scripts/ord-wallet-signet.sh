#!/bin/bash

# Helper script to run ord wallet commands with the correct configuration for the verifiable credential wallet
ord -s --bitcoin-rpc-url=http://127.0.0.1:38332 --cookie-file=/Users/brian/Projects/ordinalsplus/data/signet/.cookie --data-dir=/Users/brian/Projects/ordinalsplus/data/signet/verifiable_credential_wallet wallet "$@"
