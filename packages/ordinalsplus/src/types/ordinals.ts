import { Utxo } from './index';

/**
 * Represents a UTXO with additional metadata about inscriptions/resources
 */
export interface ResourceUtxo extends Utxo {
  /**
   * Boolean flag indicating if this UTXO contains any ordinal inscriptions
   */
  hasInscription?: boolean;
  
  /**
   * Boolean flag indicating if this UTXO contains any resources
   */
  hasResource?: boolean;
  
  /**
   * Optional identifier for the resource contained in this UTXO, if any
   */
  resourceId?: string;
  
  /**
   * Optional inscription ID if this UTXO contains an inscription
   */
  inscriptionId?: string;
  
  /**
   * The sat number of the first sat in this UTXO
   */
  satPoint?: number;
}

/**
 * Configuration options for UTXO selection
 */
export interface UtxoSelectionOptions {
  /**
   * Total amount required in satoshis
   */
  requiredAmount: number;
  
  /**
   * Fee rate in satoshis per vbyte
   */
  feeRate: number;
  
  /**
   * Whether to allow using UTXOs that contain resources
   */
  allowResourceUtxos?: boolean;
  
  /**
   * Whether to prefer older UTXOs over newer ones
   */
  preferOlder?: boolean;
  
  /**
   * Whether to prefer UTXOs close to the required amount
   */
  preferCloserAmount?: boolean;
  
  /**
   * List of UTXO IDs (txid:vout) to avoid using
   */
  avoidUtxoIds?: string[];
}

/**
 * Result of the UTXO selection process
 */
export interface UtxoSelectionResult {
  /**
   * Selected UTXOs to use in the transaction
   */
  selectedUtxos: ResourceUtxo[];
  
  /**
   * Total value of all selected UTXOs in satoshis
   */
  totalSelectedValue: number;
  
  /**
   * Estimated fee amount in satoshis
   */
  estimatedFee: number;
  
  /**
   * Change amount to return to sender in satoshis
   */
  changeAmount: number;
}
