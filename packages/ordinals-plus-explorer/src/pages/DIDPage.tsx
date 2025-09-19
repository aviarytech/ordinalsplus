import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  RotateCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  ArrowLeft,
  Share2,
  Shield,
  Eye,
  EyeOff,
  Search
} from 'lucide-react';
import DidDocumentViewer from '../components/DidDocumentViewer';
import LinkedResourceList from '../components/LinkedResourceList';
import VerifiableMetadataViewer from '../components/VerifiableMetadataViewer';
import { DidDocument, LinkedResource } from 'ordinalsplus';
import { useNetwork } from '../context/NetworkContext';
import { useApi } from '../context/ApiContext';
import { useToast } from '../contexts/ToastContext';
import { VerificationResult } from '../types/verification';

interface ResolutionMetadata {
  inscriptionId?: string;
  satNumber?: string;
  contentType?: string;
  deactivated?: boolean;
  message?: string;
  network?: string;
  foundContent?: string;
}

interface ApiResolutionResult {
  status: 'success' | 'error';
  message?: string;
  data?: {
    didDocument?: DidDocument;
    inscriptions?: Array<{
      inscriptionId: string;
      content: string;
      metadata: any;
      contentUrl?: string;
      contentType?: string;
      isValidDid?: boolean;
      didDocument?: DidDocument | null;
      error?: string;
    }>;
    resolutionMetadata?: ResolutionMetadata & {
      totalInscriptions?: number;
    };
    didDocumentMetadata?: any;
    error?: string;
    inscriptionId?: string;
    satNumber?: string;
    network?: string;
    foundContent?: string;
  };
}

interface DIDPageProps {
  onResourceSelect?: (resource: LinkedResource) => void;
}

const DIDPage: React.FC<DIDPageProps> = ({ onResourceSelect }) => {
  const { didId } = useParams<{ didId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [didDocument, setDidDocument] = useState<DidDocument | null>(null);
  const [resolutionResult, setResolutionResult] = useState<ApiResolutionResult | null>(null);
  const [allInscriptions, setAllInscriptions] = useState<Array<{
    inscriptionId: string;
    content: string;
    metadata: any;
    contentUrl?: string;
    contentType?: string;
    isValidDid?: boolean;
    didDocument?: DidDocument | null;
    error?: string;
  }> | null>(null);
  const { network } = useNetwork();
  const { apiService } = useApi();
  const { addToast } = useToast();
  const [showRawMetadata, setShowRawMetadata] = useState<Record<string, boolean>>({});
  const [verificationResults, setVerificationResults] = useState<Record<string, VerificationResult>>({});

  // Load DID when component mounts or didId changes
  useEffect(() => {
    if (didId) {
      resolveDid(didId);
    }
  }, [didId]);

  const handleVerificationComplete = (inscriptionId: string, result: VerificationResult) => {
    setVerificationResults(prev => ({
      ...prev,
      [inscriptionId]: result
    }));
  };

  // Copy DID URL to clipboard
  const copyToClipboard = () => {
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl).then(
      () => {
        addToast('DID URL copied to clipboard', 'success');
      },
      (err) => {
        console.error('Could not copy text: ', err);
        addToast('Failed to copy URL', 'error');
      }
    );
  };

  // Render inscription content with proper type detection and display
  const renderInscriptionContent = (inscription: { 
    content: string; 
    contentUrl?: string; 
    contentType?: string;
    inscriptionId: string;
  }) => {
    console.log(`[DIDPage] Rendering content for inscription ${inscription.inscriptionId}:`, {
      contentType: inscription.contentType,
      contentUrl: inscription.contentUrl,
      contentLength: inscription.content?.length,
      contentStart: inscription.content?.substring(0, 20)
    });

    // Use the provided contentType first, then try to determine from URL or content
    let detectedContentType = inscription.contentType || '';
    
    // Check if contentUrl contains hints about content type if contentType is not provided
    if (!detectedContentType && inscription.contentUrl) {
      if (inscription.contentUrl.includes('content-type=image%2Fpng') || 
          inscription.contentUrl.includes('content-type=image/png')) {
        detectedContentType = 'image/png';
      } else if (inscription.contentUrl.includes('content-type=image%2Fjpeg') || 
                 inscription.contentUrl.includes('content-type=image/jpeg')) {
        detectedContentType = 'image/jpeg';
      } else if (inscription.contentUrl.includes('content-type=image%2Fgif') || 
                 inscription.contentUrl.includes('content-type=image/gif')) {
        detectedContentType = 'image/gif';
      } else if (inscription.contentUrl.includes('content-type=image%2Fsvg') || 
                 inscription.contentUrl.includes('content-type=image/svg')) {
        detectedContentType = 'image/svg+xml';
      } else if (inscription.contentUrl.includes('content-type=application%2Fjson') || 
                 inscription.contentUrl.includes('content-type=application/json')) {
        detectedContentType = 'application/json';
      }
    }
    
    // Try to detect from content for binary signatures if still no type
    if (!detectedContentType && inscription.content) {
      const content = inscription.content;
      // Check for PNG signature - both in base64 and raw binary
      if (content.startsWith('iVBORw0KGgo') || 
          content.includes('89504e47') || 
          content.startsWith('PNG') ||  // Raw PNG header
          content.includes('\x89PNG\r\n\x1a\n')) {  // PNG binary signature
        detectedContentType = 'image/png';
        console.log(`[DIDPage] Detected PNG from content signature for ${inscription.inscriptionId}`);
      } else if (content.startsWith('/9j/') || content.includes('ffd8ff')) {
        detectedContentType = 'image/jpeg';
      } else if (content.startsWith('R0lGODlh') || content.includes('474946')) {
        detectedContentType = 'image/gif';
      } else if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
        try {
          JSON.parse(content);
          detectedContentType = 'application/json';
        } catch (e) {
          // Not valid JSON
        }
      }
    }

    console.log(`[DIDPage] Final detected content type for ${inscription.inscriptionId}: ${detectedContentType}`);

    // For images, if we have a contentUrl, always try to render as image first
    if ((detectedContentType.startsWith('image/') || 
         inscription.content?.startsWith('PNG') ||
         inscription.content?.startsWith('iVBORw0KGgo')) && 
        inscription.contentUrl) {
      
      console.log(`[DIDPage] Attempting to render image for ${inscription.inscriptionId} with URL: ${inscription.contentUrl}`);
      
      return (
        <div className="mt-1">
          <div className="relative flex flex-col items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-2">
            {/* Add a test link to check if URL is accessible */}
            <div className="w-full mb-2 text-xs text-gray-500">
              <span>Test URL: </span>
              <a 
                href={inscription.contentUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Open in new tab
              </a>
            </div>
            
            <img 
              src={inscription.contentUrl} 
              alt={`Inscription ${inscription.inscriptionId}`}
              className="max-h-40 max-w-full object-contain rounded-md"
              onLoad={() => {
                console.log(`✅ Successfully loaded image for inscription ${inscription.inscriptionId}`);
              }}
              onError={(e) => {
                console.error(`❌ Failed to load image for inscription ${inscription.inscriptionId}:`, e);
                console.log(`Image URL was: ${inscription.contentUrl}`);
                console.log(`User agent: ${navigator.userAgent}`);
                
                // Test if the URL is accessible with fetch
                if (inscription.contentUrl) {
                  fetch(inscription.contentUrl)
                    .then(response => {
                      console.log(`Fetch test result for ${inscription.contentUrl}:`, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: Object.fromEntries(response.headers.entries())
                      });
                    })
                    .catch(fetchError => {
                      console.error(`Fetch test failed for ${inscription.contentUrl}:`, fetchError);
                    });
                }
                
                // Fallback to text display on error
                const target = e.target as HTMLImageElement;
                const container = target.parentElement;
                if (container) {
                  container.innerHTML = `
                    <div class="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-xs">
                      <div class="text-red-700 dark:text-red-300 font-medium mb-1">Image failed to load</div>
                      <div class="text-red-600 dark:text-red-400 text-xs">URL: ${inscription.contentUrl}</div>
                      <div class="text-gray-600 dark:text-gray-400 mt-2 font-mono text-xs break-all max-h-16 overflow-y-auto">
                        Raw content: ${inscription.content?.substring(0, 200) || 'Content not available'}...
                      </div>
                    </div>
                  `;
                }
              }}
            />
            <div className="text-xs text-gray-500 mt-1">
              {detectedContentType || 'image'} • {inscription.inscriptionId}
            </div>
          </div>
        </div>
      );
    } else if (detectedContentType === 'text/html' && inscription.contentUrl) {
      // Render HTML content in an iframe so it can load its own assets safely
      return (
        <div className="mt-1">
          <iframe
            src={inscription.contentUrl}
            className="w-full h-40 border border-gray-300 dark:border-gray-600 rounded"
            sandbox="allow-scripts allow-same-origin"
            title={`HTML content ${inscription.inscriptionId}`}
          />
          <div className="text-xs text-gray-500 mt-1">
            {detectedContentType} • {inscription.inscriptionId}
          </div>
        </div>
      );
    } else if (detectedContentType === 'application/json' || 
               (inscription.content && inscription.content.trim().startsWith('{') && inscription.content.trim().endsWith('}'))) {
      // Pretty print JSON content
      try {
        const jsonData = JSON.parse(inscription.content);
        return (
          <div className="mt-1">
            <div className="p-2 bg-gray-100 dark:bg-gray-600 rounded text-xs font-mono break-all max-h-20 overflow-y-auto">
              {JSON.stringify(jsonData, null, 2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {detectedContentType || 'application/json'} • {inscription.inscriptionId}
            </div>
          </div>
        );
      } catch (e) {
        // Fallback to raw text if JSON parsing fails
        return (
          <div className="mt-1">
            <div className="p-2 bg-gray-100 dark:bg-gray-600 rounded text-xs font-mono break-all max-h-20 overflow-y-auto">
              {inscription.content || 'No content available'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {detectedContentType || 'text/plain'} • {inscription.inscriptionId}
            </div>
          </div>
        );
      }
    } else {
      // Default: if we have a URL and it's not an image/JSON, try iframe preview; otherwise show text
      if (inscription.contentUrl && (!detectedContentType || !detectedContentType.startsWith('image/'))) {
        return (
          <div className="mt-1">
            <iframe
              src={inscription.contentUrl}
              className="w-full h-40 border border-gray-300 dark:border-gray-600 rounded"
              sandbox="allow-scripts allow-same-origin"
              title={`Content ${inscription.inscriptionId}`}
            />
            <div className="text-xs text-gray-500 mt-1">
              {detectedContentType || 'text/html'} • {inscription.inscriptionId}
            </div>
          </div>
        );
      }
      return (
        <div className="mt-1">
          <div className="p-2 bg-gray-100 dark:bg-gray-600 rounded text-xs font-mono break-all max-h-20 overflow-y-auto">
            {inscription.content || 'No content available'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {detectedContentType || 'text/plain'} • {inscription.inscriptionId}
          </div>
        </div>
      );
    }
  };

  // Direct resolution function that accepts a DID parameter
  const resolveDid = async (didToResolve: string) => {
    if (!didToResolve.trim()) return;

    setIsLoading(true);
    setError(null);
    setDidDocument(null);
    setResolutionResult(null);
    setAllInscriptions(null);

    try {
      if (!apiService) {
        throw new Error('API service not available');
      }

      // Use the backend API endpoint for DID resolution
      try {
        const result = await apiService.resolveDid(didToResolve.trim());
        
        // Create a result structure that matches our interface
        const apiResult: ApiResolutionResult = {
          status: 'success',
          data: {
            didDocument: result.didDocument,
            inscriptions: result.inscriptions,
            resolutionMetadata: {
              contentType: result.resolutionMetadata?.contentType,
              inscriptionId: result.resolutionMetadata?.inscriptionId,
              satNumber: result.resolutionMetadata?.satNumber,
              network: result.resolutionMetadata?.network,
              deactivated: result.resolutionMetadata?.deactivated,
              totalInscriptions: result.resolutionMetadata?.totalInscriptions
            },
            didDocumentMetadata: result.didDocumentMetadata
          }
        };
        
        setResolutionResult(apiResult);
        setAllInscriptions(result.inscriptions || null);
        
        if (result.didDocument) {
          setDidDocument(result.didDocument);
        } else {
          // Check if we have inscriptions - if so, just show them without treating as error
          if (result.inscriptions && result.inscriptions.length > 0) {
            const validDidInscriptions = result.inscriptions.filter(i => i.isValidDid);
            if (validDidInscriptions.length > 0) {
              setError(`Found ${result.inscriptions.length} inscription(s) on this satoshi, ${validDidInscriptions.length} contain(s) DID references, but no valid DID document could be extracted. Check the metadata or inscription content.`);
            } else {
              // Don't set error for this case - just show the inscriptions
              console.log(`Found ${result.inscriptions.length} inscription(s) on this satoshi, but none contain valid BTCO DID references.`);
            }
          } else {
            setError('No inscriptions found on this satoshi');
          }
        }
      } catch (apiError) {
        // Handle specific API errors
        const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
        
        if (errorMessage.includes('metadataNotAvailable')) {
          setError(
            'BTCO DID found but full resolution is not yet available. ' +
            'The inscription exists and contains a valid DID reference, but CBOR metadata parsing is needed to extract the DID document.'
          );
        } else if (errorMessage.includes('deactivated')) {
          setError('This DID has been deactivated (🔥)');
        } else if (errorMessage.includes('404') || errorMessage.includes('Not Found') || errorMessage.includes('notFound')) {
          if (didToResolve.includes('sig:')) {
            setError(
              `DID not found: ${didToResolve}\n\n` +
              'For signet network:\n' +
              '• Make sure your local ord node is running on http://127.0.0.1:80\n' +
              '• Verify the satoshi number has inscriptions\n' +
              '• Check that the inscription contains a valid BTCO DID document'
            );
          } else {
            setError(`DID not found: ${didToResolve}`);
          }
        } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
          setError(
            'Server error occurred while resolving DID. This might be due to the BTCO DID resolution implementation being incomplete. ' +
            'Please try again later or contact support if the issue persists.'
          );
        } else if (errorMessage.includes('Failed to connect') || errorMessage.includes('ECONNREFUSED')) {
          if (didToResolve.includes('sig:')) {
            setError(
              'Connection failed to local ord node. For signet DIDs:\n\n' +
              '• Ensure your local ord signet node is running\n' +
              '• Check that it\'s accessible at http://127.0.0.1:80\n' +
              '• Verify the node is fully synced'
            );
          } else {
            setError(`Connection failed: ${errorMessage}`);
          }
        } else {
          setError(`Resolution failed: ${errorMessage}`);
        }

        setResolutionResult({
          status: 'error',
          message: errorMessage
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resolve DID';
      
      // Provide specific guidance for common issues
      if (errorMessage.includes('Network request failed') || errorMessage.includes('fetch')) {
        setError(
          'Network Error: Unable to connect to the API. ' +
          'Please check your internet connection and try again.'
        );
      } else {
        setError(errorMessage);
      }
      
      setResolutionResult({
        status: 'error',
        message: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderResolutionMetadata = () => {
    if (!resolutionResult || !resolutionResult.data?.resolutionMetadata) return null;

    const metadata = resolutionResult.data.resolutionMetadata;

    return (
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          Resolution Details
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {metadata.inscriptionId && (
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Latest Valid Inscription:</span>
              <div className="flex items-center gap-2">
                <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono">
                  {metadata.inscriptionId}
                </code>
                <a
                  href={`https://ordiscan.com/inscription/${metadata.inscriptionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
          
          {metadata.satNumber && (
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Satoshi Number:</span>
              <p className="text-gray-900 dark:text-gray-100 font-mono">{metadata.satNumber}</p>
            </div>
          )}
          
          {metadata.network && (
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Network:</span>
              <p className="text-gray-900 dark:text-gray-100">{metadata.network}</p>
            </div>
          )}
          
          {metadata.totalInscriptions && (
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Total Inscriptions:</span>
              <p className="text-gray-900 dark:text-gray-100">{metadata.totalInscriptions}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAllInscriptions = () => {
    if (!allInscriptions || allInscriptions.length === 0) return null;

    return (
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-500" />
          All Inscriptions on Satoshi ({allInscriptions.length})
        </h3>
        
        <div className="space-y-3">
          {allInscriptions.map((inscription, index) => (
            <div key={inscription.inscriptionId} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    #{index + 1}
                  </span>
                  {inscription.isValidDid && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                      Valid DID
                    </span>
                  )}
                  {inscription.didDocument && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                      Has DID Document
                    </span>
                  )}
                  {inscription.error && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100">
                      Error
                    </span>
                  )}
                </div>
                <a
                  href={`https://ordiscan.com/inscription/${inscription.inscriptionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              
              {inscription.metadata ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Verification Component (Full Height) */}
                  <div className="col-span-1">
                    <VerifiableMetadataViewer 
                      inscriptionId={inscription.inscriptionId}
                      metadata={inscription.metadata}
                      autoVerify={true}
                      verificationOnly={true}
                      className="w-full h-full"
                      onVerificationComplete={(result) => handleVerificationComplete(inscription.inscriptionId, result)}
                      expectedSatNumber={resolutionResult?.data?.resolutionMetadata?.satNumber}
                    />
                  </div>

                  {/* Right Column - All Inscription Information */}
                  <div className="col-span-1 space-y-4">
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">Inscription ID:</span>
                        <code className="bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded text-xs font-mono ml-2">
                          {inscription.inscriptionId}
                        </code>
                      </div>
                      
                      {inscription.contentUrl && (
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Content URL:</span>
                          <a 
                            href={inscription.contentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600 text-xs ml-2 break-all"
                          >
                            {inscription.contentUrl}
                          </a>
                        </div>
                      )}
                      
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">Content:</span>
                        {renderInscriptionContent(inscription)}
                      </div>
                    </div>

                    {/* Metadata Information */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-600 dark:text-gray-400">Metadata:</span>
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-500" />
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                              Verifiable Credential
                            </span>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => setShowRawMetadata(prev => ({ ...prev, [inscription.inscriptionId]: !prev[inscription.inscriptionId] }))}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          {showRawMetadata[inscription.inscriptionId] ? (
                            <>
                              <EyeOff className="w-3 h-3" />
                              Hide Raw
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" />
                              Show Raw
                            </>
                          )}
                        </button>
                      </div>

                      {/* VC Summary */}
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-3">
                        <div className="space-y-3 text-sm">
                          {inscription.metadata.id && (
                            <div>
                              <span className="font-medium text-blue-700 dark:text-blue-300">ID:</span>
                              <div className="text-blue-600 dark:text-blue-400 text-xs font-mono break-all mt-1">
                                {inscription.metadata.id}
                              </div>
                            </div>
                          )}
                          
                          {inscription.metadata.issuer && (
                            <div>
                              <span className="font-medium text-blue-700 dark:text-blue-300">Issuer:</span>
                              <div className="text-blue-600 dark:text-blue-400 text-xs font-mono break-all mt-1">
                                {typeof inscription.metadata.issuer === 'string' ? inscription.metadata.issuer : inscription.metadata.issuer.id}
                              </div>
                            </div>
                          )}
                          
                          {inscription.metadata.credentialSubject && (
                            <div>
                              <span className="font-medium text-blue-700 dark:text-blue-300">Subject:</span>
                              <div className="text-blue-600 dark:text-blue-400 text-xs font-mono break-all mt-1">
                                {typeof inscription.metadata.credentialSubject === 'string' ? 
                                  inscription.metadata.credentialSubject : 
                                  inscription.metadata.credentialSubject.id || JSON.stringify(inscription.metadata.credentialSubject).substring(0, 50) + '...'}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Raw Metadata (toggleable) */}
                      {showRawMetadata[inscription.inscriptionId] && (
                        <div className="border-t pt-3">
                          <pre className="text-xs bg-gray-100 dark:bg-gray-600 p-2 rounded max-h-40 overflow-y-auto">
                            {JSON.stringify(inscription.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>

                    {inscription.error && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <h6 className="text-sm font-medium text-red-800 dark:text-red-200">Processing Error</h6>
                            <p className="text-sm text-red-600 dark:text-red-300 mt-1">{inscription.error}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h6 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">No Metadata Available</h6>
                      <p className="text-sm text-yellow-600 dark:text-yellow-300 mt-1">
                        This inscription does not contain verifiable metadata.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <RotateCw className="w-8 h-8 animate-spin text-orange-500" />
        <span className="ml-2 text-gray-700 dark:text-gray-300">Resolving DID...</span>
      </div>
    );
  }

  if (!didId) {
    return (
      <div className="max-w-7xl mx-auto p-5">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <p className="text-red-700 dark:text-red-300">No DID specified in URL</p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Explorer
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with DID info and actions */}
      <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">
              DID: <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-sm">{didId}</code>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="inline-flex items-center px-3 py-1.5 border border-blue-300 dark:border-blue-600 text-sm font-medium rounded-md text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
            >
              <Share2 className="w-4 h-4 mr-1" />
              Share
            </button>
            <Link
              to="/"
              className="inline-flex items-center px-3 py-1.5 border border-blue-300 dark:border-blue-600 text-sm font-medium rounded-md text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Explorer
            </Link>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg dark:bg-red-900 dark:border-red-700 dark:text-red-100 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium">Resolution Failed</h4>
            <p className="mt-1 whitespace-pre-line">{error}</p>
          </div>
        </div>
      )}

      {/* Resolution Metadata */}
      {resolutionResult && !error && renderResolutionMetadata()}

      {/* All Inscriptions */}
      {renderAllInscriptions()}

      {/* DID Document and Resources */}
      {didDocument && (
        <div className="space-y-6">
          <DidDocumentViewer document={didDocument} />
          <LinkedResourceList
            did={didId}
            onResourceSelect={onResourceSelect || (() => {})}
          />
        </div>
      )}
    </div>
  );
};

export default DIDPage; 