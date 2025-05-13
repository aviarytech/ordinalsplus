import { EventEmitter } from 'events';
import { Utxo } from '../types';
import { errorHandler, ErrorCode } from '../utils/error-handler';
import { transactionTracker, TransactionStatus, TransactionType } from '../transactions/transaction-status-tracker';
import { Transaction } from '../types/transaction';
import { generateP2TRKeyPair } from './p2tr/keyGeneration';
import { prepareContent } from './content/mime-handling';
import { calculateFees } from '../transactions/fees';
import { CommitTransaction } from '../transactions/commit';
import { RevealTransaction } from '../transactions/reveal';
import { generateInscriptionScript } from './scripts/inscriptionScriptGeneration';
/**
 * Orchestrates the complete inscription process from content preparation
 * to transaction confirmation, coordinating all the components.
 */
export class InscriptionOrchestrator extends EventEmitter {
  private inscriptionData: {
    content?: any;
    contentType?: string;
    utxo?: Utxo;
    commitTx?: Transaction;
    revealTx?: Transaction;
    fees?: {
      commit: number;
      reveal: number;
      total: number;
    };
    keys?: {
      internalKey: Buffer;
      outputKey: Buffer;
      address: string;
    };
  };

  constructor() {
    super();
    this.inscriptionData = {};
  }

  /**
   * Prepare content for inscription
   * @param content The content to inscribe
   * @param contentType MIME type of the content
   */
  async prepareContent(content: any, contentType: string): Promise<void> {
    try {
      this.inscriptionData.content = prepareContent(content, contentType);
      this.inscriptionData.contentType = contentType;
      this.emit('contentPrepared', { content: this.inscriptionData.content, contentType });
    } catch (error) {
      const handledError = errorHandler.handleError(error);
      this.emit('error', handledError);
      throw handledError;
    }
  }

  /**
   * Set the UTXO to be used for the inscription
   * @param utxo The UTXO to use
   */
  selectUTXO(utxo: Utxo): void {
    this.inscriptionData.utxo = utxo;
    this.emit('utxoSelected', utxo);
  }

  /**
   * Calculate and set fees for the inscription transactions
   * @param feeRate The fee rate in sats/vbyte
   */
  async calculateFees(feeRate: number): Promise<{ commit: number; reveal: number; total: number }> {
    try {
      if (!this.inscriptionData.content || !this.inscriptionData.contentType) {
        throw new Error('Content must be prepared before calculating fees');
      }

      const { content, contentType } = this.inscriptionData;
      const fees = await calculateFees(content, contentType, feeRate);
      
      this.inscriptionData.fees = fees;
      this.emit('feesCalculated', fees);
      
      return fees;
    } catch (error) {
      const handledError = errorHandler.handleError(error);
      this.emit('error', handledError);
      throw handledError;
    }
  }

  /**
   * Create and submit the commit transaction
   * @returns The commit transaction ID
   */
  async executeCommitTransaction(): Promise<string> {
    try {
      if (!this.inscriptionData.fees) {
        throw new Error('Fees must be calculated before executing transactions');
      }

      // Generate keys for the inscription
      const keyPair = await generateP2TRKeyPair();
      this.inscriptionData.keys = keyPair;
      
      // Create and send commit transaction
      const commitTx = new CommitTransaction(keyPair.address, this.inscriptionData.fees.commit);
      const txid = await commitTx.send();
      
      // Track the transaction status
      transactionTracker.addTransaction({
        id: txid,
        txid,
        type: TransactionType.COMMIT,
        status: TransactionStatus.PENDING,
        createdAt: new Date(),
        lastUpdatedAt: new Date()
      });
      
      this.inscriptionData.commitTx = { txid };
      this.emit('commitTransactionSent', { txid });
      
      return txid;
    } catch (error) {
      const handledError = errorHandler.handleError(error);
      this.emit('error', handledError);
      throw handledError;
    }
  }

  /**
   * Create and submit the reveal transaction
   * @returns The reveal transaction ID
   */
  async executeRevealTransaction(): Promise<string> {
    try {
      if (!this.inscriptionData.commitTx || !this.inscriptionData.keys || 
          !this.inscriptionData.content || !this.inscriptionData.contentType || 
          !this.inscriptionData.fees || !this.inscriptionData.utxo) {
        throw new Error('Commit transaction must be confirmed and all data prepared before reveal');
      }

      // Generate the inscription script
      const inscriptionScript = await generateInscriptionScript(
        this.inscriptionData.content,
        this.inscriptionData.contentType,
        this.inscriptionData.keys.internalKey
      );
      
      // Create and send reveal transaction
      const revealTx = new RevealTransaction(
        this.inscriptionData.commitTx.txid,
        inscriptionScript,
        this.inscriptionData.utxo,
        this.inscriptionData.fees.reveal
      );
      
      const txid = await revealTx.send();
      
      // Track the transaction status
      transactionTracker.addTransaction({
        id: txid,
        txid,
        type: TransactionType.REVEAL,
        status: TransactionStatus.PENDING,
        createdAt: new Date(),
        lastUpdatedAt: new Date()
      });
      
      this.inscriptionData.revealTx = { txid };
      this.emit('revealTransactionSent', { txid });
      
      return txid;
    } catch (error) {
      throw errorHandler.handleError(error);
    }
  }

  /**
   * Get the current state of the inscription process
   */
  getState(): any {
    return { ...this.inscriptionData };
  }

  /**
   * Reset the orchestrator to its initial state
   */
  reset(): void {
    this.inscriptionData = {};
    this.emit('reset');
  }
}

// Export a singleton instance
export const inscriptionOrchestrator = new InscriptionOrchestrator(); 