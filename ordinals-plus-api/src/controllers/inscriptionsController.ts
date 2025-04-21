import * as bitcoin from 'bitcoinjs-lib';
import type { 
    GenericInscriptionRequest, 
    DidInscriptionRequest, 
    PsbtResponse, 
    FeeEstimateResponse, 
    TransactionStatusResponse 
} from '../types';
import { getFeeEstimates as fetchFeeEstimates } from '../services/feeService';
import { getTransactionStatus as fetchTransactionStatus } from '../services/blockchainService';
import { constructGenericPsbt, constructDidPsbt } from '../services/psbtService';

// --- Fee Estimation --- 

export async function getFeeEstimates(): Promise<FeeEstimateResponse> {
    console.log('Controller: Fetching fee estimates...');
    try {
        const estimates = await fetchFeeEstimates(); 
        return estimates;
    } catch (error) {
        console.error('Controller: Error fetching fee estimates:', error);
        throw error;
    }
}

// --- Inscription PSBT Creation --- 

export async function createGenericInscriptionPsbt(request: GenericInscriptionRequest): Promise<PsbtResponse> {
    console.log('Controller: Creating Generic/Resource Inscription PSBT...');
    try {
        const result = await constructGenericPsbt(request);
        return result;
    } catch (error) {
        console.error('Controller: Error creating generic/resource inscription PSBT:', error);
        throw new Error(`Failed to create inscription PSBT: ${error}`);
    }
}

export async function createDidInscriptionPsbt(request: DidInscriptionRequest): Promise<PsbtResponse> {
    console.log('Controller: Creating DID Inscription PSBT...');
    try {
        const result = await constructDidPsbt(request);
        return result;
    } catch (error) {
        console.error('Controller: Error creating DID inscription PSBT:', error);
        throw new Error(`Failed to create DID inscription PSBT: ${error}`);
    }
}

// --- Transaction Status --- 

export async function getTransactionStatus(txid: string): Promise<TransactionStatusResponse> {
    console.log(`Controller: Checking status for transaction: ${txid}`);
    try {
        const status = await fetchTransactionStatus(txid);
        return status;
    } catch (error) {
        console.error(`Controller: Error checking transaction status for ${txid}:`, error);
        throw new Error('Failed to check transaction status');
    }
} 