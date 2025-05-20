#!/bin/bash

# Helper script to run bitcoin-cli with the correct configuration for Signet
bitcoin-cli -conf=/Users/brian/Projects/ordinalsplus/bitcoin.conf -signet "$@"
