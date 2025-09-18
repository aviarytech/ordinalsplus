/**
 * Verification Controller
 * 
 * This controller handles API endpoints for verifying inscriptions and credentials.
 */
import { VerificationService } from '../services/verificationService';
import { VerificationStatus, type VerificationCheck } from '../types/verification';
import { logger } from '../utils/logger';

/**
 * Controller for verification-related API endpoints
 */
export class VerificationController {
  /**
   * Create a new verification controller
   * 
   * @param verificationService - Service for verifying inscriptions and credentials
   */
  constructor(private verificationService: VerificationService) {}

  /**
   * Verify an inscription by its ID
   * 
   * @param inscriptionId - ID of the inscription to verify
   * @returns Verification result
   */
  async verifyInscription(inscriptionId: string) {
    if (!inscriptionId) {
      return {
        status: 'error',
        message: 'Missing inscription ID'
      };
    }

    try {
      logger.info(`API: Verifying inscription ${inscriptionId}`);
      const result = await this.verificationService.verifyInscription(inscriptionId);
      
      // Transform the verification result into API response format
      return this.formatVerificationResponse(result);
    } catch (error) {
      logger.error(`Error verifying inscription ${inscriptionId}: ${error}`);
      
      return {
        status: 'error',
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Verify a credential directly
   * 
   * @param body - Request body containing the credential
   * @returns Verification result
   */
  async verifyCredential(body: { credential: any }) {
    const { credential } = body;
    
    if (!credential) {
      return {
        status: 'error',
        message: 'Missing credential in request body'
      };
    }

    try {
      logger.info(`API: Verifying credential ${credential.id || 'unknown'}`);
      const result = await this.verificationService.verifyCredential(credential);
      
      // Transform the verification result into API response format
      return this.formatVerificationResponse(result);
    } catch (error) {
      logger.error(`Error verifying credential: ${error}`);
      
      return {
        status: 'error',
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get information about an issuer by DID
   * 
   * @param did - DID of the issuer
   * @returns Issuer information
   */
  async getIssuerInfo(did: string) {
    if (!did) {
      return {
        status: 'error',
        message: 'Missing DID parameter'
      };
    }

    try {
      logger.info(`API: Getting issuer info for ${did}`);
      const issuerInfo = await this.verificationService.getIssuerInfo(did);
      
      return {
        status: 'success',
        issuer: issuerInfo
      };
    } catch (error) {
      logger.error(`Error getting issuer info for ${did}: ${error}`);
      
      return {
        status: 'error',
        message: `Failed to get issuer info: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Format verification result for API response
   * 
   * @param result - Internal verification result
   * @returns Formatted API response
   */
  private formatVerificationResponse(result: any) {
    // Extract verification checks from the result
    const checks: VerificationCheck[] = [];
    
    // Add signature check if credential exists
    if (result.credential && result.status) {
      checks.push({
        id: 'signature',
        name: 'Digital Signature',
        category: 'signature',
        passed: result.status === VerificationStatus.VALID,
        explanation: result.status === VerificationStatus.VALID
          ? 'The credential signature is valid and was created by the issuer.'
          : 'The credential signature is invalid or could not be verified.'
      });

      // Add expiration check if applicable
      if (result.credential.expirationDate) {
        const expirationDate = new Date(result.credential.expirationDate);
        const isExpired = expirationDate < new Date();
        
        checks.push({
          id: 'expiration',
          name: 'Expiration Date',
          category: 'expiration',
          passed: !isExpired,
          explanation: isExpired
            ? `The credential expired on ${expirationDate.toISOString()}.`
            : `The credential is valid until ${expirationDate.toISOString()}.`
        });
      }
    }

    // Format the response
    return {
      status: result.status,
      message: result.message || this.getDefaultMessageForStatus(result.status),
      details: {
        inscriptionId: result.inscriptionId,
        issuer: result.issuer,
        verifiedAt: result.verifiedAt || new Date().toISOString(),
        checks
      },
      credential: result.credential
    };
  }

  /**
   * Get default message for verification status
   * 
   * @param status - Verification status
   * @returns Default message
   */
  private getDefaultMessageForStatus(status: string): string {
    switch (status) {
      case VerificationStatus.VALID:
        return 'The credential is valid and has been successfully verified.';
      case VerificationStatus.INVALID:
        return 'The credential is invalid or has been tampered with.';
      case VerificationStatus.NO_METADATA:
        return 'No verifiable metadata found for this inscription.';
      case VerificationStatus.ERROR:
        return 'An error occurred during verification.';
      default:
        return 'Unknown verification status.';
    }
  }
}

export default VerificationController;
