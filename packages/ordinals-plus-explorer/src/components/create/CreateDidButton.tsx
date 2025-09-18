import React, { useState } from 'react';
import { Button } from '../ui';
import { Key, Download, Loader2, Shield } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { useToast } from '../../contexts/ToastContext';
import { generateEd25519KeyPair, privateKeyToMultibase, publicKeyToMultibase } from '../../lib/utils/keyUtils';
import { useResourceInscription } from '../inscription/ResourceInscriptionWizard';
import { useApi } from '../../context/ApiContext';
import { useNetwork } from '../../context/NetworkContext';

interface CreateDidButtonProps {
  className?: string;
  onDidCreated?: (did: string, privateKey: string) => void;
}

/**
 * CreateDidButton component that creates a BTCO DID by:
 * 1. Generating a key pair
 * 2. Creating a DID document according to BTCO DID spec
 * 3. Setting up the inscription wizard to inscribe the DID document as metadata
 * 4. Downloading the private key for the user
 */
const CreateDidButton: React.FC<CreateDidButtonProps> = ({ className, onDidCreated }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const { connected: walletConnected, network: walletNetwork } = useWallet();
  const { addToast, addErrorToast } = useToast();
  const { state, setContentData, setMetadata, goToStep } = useResourceInscription();
  const { apiService } = useApi();
  const { network } = useNetwork();

  // Get the actual sat number from a UTXO using the API
  const getSatNumberFromUtxo = async (txid: string, vout: number): Promise<string> => {
    if (!apiService) {
      throw new Error('API service not available');
    }
    
    const utxo = `${txid}:${vout}`;
    const networkType = network?.type || walletNetwork || 'mainnet';
    const satNumber = await apiService.getSatNumber(networkType, utxo);
    return satNumber.toString();
  };

  // Get network-specific DID prefix
  const getDidPrefix = (network: string | null): string => {
    switch (network) {
      case 'testnet':
        return 'did:btco:test';
      case 'signet':
        return 'did:btco:sig';
      default:
        return 'did:btco';
    }
  };

  // Generate a key ID from the multibase key using a deterministic approach
  const generateKeyIdFromMultibase = (multibaseKey: string): string => {
    // Use a simple hash-based approach to create a deterministic key ID
    // This creates a unique identifier based on the key material itself
    // In production, you might want to use a more sophisticated hash like SHA-256
    
    const keyMaterial = multibaseKey.slice(1); // Remove 'z' prefix
    
    // Simple hash function to create a short, deterministic identifier
    let hash = 0;
    for (let i = 0; i < keyMaterial.length; i++) {
      const char = keyMaterial.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to a positive hex string (8 characters for good uniqueness)
    const keyId = Math.abs(hash).toString(16).padStart(8, '0');
    return keyId;
  };

  // Create a DID Document according to BTCO DID spec
  const createDidDocument = (satNumber: string, keyPair: any) => {
    const didPrefix = getDidPrefix(walletNetwork);
    const did = `${didPrefix}:${satNumber}`;
    
    // Generate the multibase key first
    const multibaseKey = publicKeyToMultibase(keyPair.publicKey);
    
    // Generate key ID from the multibase key itself
    const keyId = generateKeyIdFromMultibase(multibaseKey);
    const fullKeyId = `${did}#${keyId}`;
    
    // Create the verification method using Multikey type (as per spec update)
    const verificationMethod = {
      id: fullKeyId,
      type: 'Multikey',
      controller: did,
      publicKeyMultibase: multibaseKey
    };

    // Create the DID Document following the BTCO spec format
    const didDocument = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/multikey/v1'
      ],
      id: did,
      verificationMethod: [verificationMethod],
      authentication: [fullKeyId],
      assertionMethod: [fullKeyId]
    };

    return { did, didDocument, keyId: fullKeyId, multibaseKey };
  };

  const downloadPrivateKey = (did: string, keyId: string, multibaseKey: string, privateKey: Uint8Array) => {
    const secretKeyMultibase = privateKeyToMultibase(privateKey);

    const keyData = {
      did,
      keyId, // Include the key ID derived from the multibase key
      publicKeyMultibase: multibaseKey, // Include the multibase public key
      secretKeyMultibase, // Include the multibase secret key
      privateKey: Array.from(privateKey), // Convert Uint8Array to regular array for JSON
      privateKeyHex: Buffer.from(privateKey).toString('hex'),
      type: 'Ed25519',
      created: new Date().toISOString(),
      warning: 'Keep this private key secure. It controls your DID and cannot be recovered if lost.',
      instructions: [
        '1. Store this file in a secure location',
        '2. This private key controls your DID and cannot be recovered if lost',
        '3. The keyId is derived from your public key for secure identification',
        '4. You can use this key to update or manage your DID in the future',
        '5. Never share this private key with anyone'
      ]
    };

    const blob = new Blob([JSON.stringify(keyData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `did-private-key-${did.replace(/[^a-zA-Z0-9]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCreateDid = async () => {
    if (!walletConnected) {
      addErrorToast(new Error('Please connect your wallet to create a DID.'));
      return;
    }

    setIsCreating(true);

    try {
      // 1. Generate Ed25519 key pair
      const keyPair = generateEd25519KeyPair();
      
      // 2. Calculate satoshi number based on selected UTXO
      let satNumber: string;
      if (state.inscriptionUtxo) {
        const utxo = state.inscriptionUtxo;
        satNumber = await getSatNumberFromUtxo(utxo.txid, utxo.vout);
        addToast(`Using satoshi number ${satNumber} from UTXO: ${utxo.txid}:${utxo.vout}`, 'info');
      } else if (state.utxoSelection && state.utxoSelection.length > 0) {
        // Fallback: support legacy selection array
        const utxo = state.utxoSelection[0];
        satNumber = await getSatNumberFromUtxo(utxo.txid, utxo.vout);
        addToast(`Using satoshi number ${satNumber} from UTXO: ${utxo.txid}:${utxo.vout}`, 'info');
      } else {
        addErrorToast(new Error('Please select a UTXO to create a DID.'));
        return;
      }
      
      // 3. Create the DID document
      const { did, didDocument, keyId, multibaseKey } = createDidDocument(satNumber, keyPair);
      
      // 4. Log what will be CBOR encoded for debugging
      console.log('🔍 DID Document that will be CBOR encoded:', didDocument);
      console.log('📏 DID Document JSON size:', JSON.stringify(didDocument).length, 'bytes');
      
      // 5. Set up the inscription wizard with DID content
      // Use simple text content for the inscription (DID operations are controlled via metadata)
      setContentData({
        type: 'text/plain',
        content: `BTCO DID: ${did}\nCreated: ${new Date().toISOString()}\n\nThis inscription contains a BTCO DID document in the metadata.`,
        preview: `BTCO DID: ${did}`
      });

      // 6. Set the DID document as metadata (this is where the actual DID data goes)
      setMetadata({
        isVerifiableCredential: false,
        standard: didDocument, // The DID document goes here as standard metadata
        verifiableCredential: {
          provider: null,
          exchangeVariables: {},
          credential: null
        }
      });

      // 7. Download the private key
      downloadPrivateKey(did, keyId, multibaseKey, keyPair.secretKey);

      // 8. Jump to the transaction step (step 3) - but if no UTXO selected, go to UTXO step first
      if (state.inscriptionUtxo || (state.utxoSelection && state.utxoSelection.length > 0)) {
        goToStep(3); // Skip to transaction step
      } else {
        goToStep(0); // Go to UTXO selection step first
      }

      // 9. Notify about successful setup
      addToast(`DID ${did} has been prepared for inscription. Your private key has been downloaded.`, 'success');

      // 10. Call the callback if provided
      if (onDidCreated) {
        onDidCreated(did, Buffer.from(keyPair.secretKey).toString('hex'));
      }

    } catch (error) {
      console.error('Error creating DID:', error);
      addErrorToast(
        error instanceof Error 
          ? error 
          : new Error('An unknown error occurred while creating the DID.')
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex gap-2">
      {/* Create DID Button */}
      <Button
        onClick={handleCreateDid}
        disabled={!walletConnected || isCreating}
        className={`flex items-center gap-2 ${className || ''}`}
        variant="default"
      >
        {isCreating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating DID...
          </>
        ) : (
          <>
            <Shield className="w-4 h-4" />
            <Key className="w-4 h-4" />
            Create DID
            <Download className="w-4 h-4" />
          </>
        )}
      </Button>
    </div>
  );
};

export default CreateDidButton; 