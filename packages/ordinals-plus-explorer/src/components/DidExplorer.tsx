import React, { useState } from 'react';
import {
  Search,
  RotateCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Shield,
  Eye,
  EyeOff,
  List,
  ArrowLeft
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DidDocumentViewer from './DidDocumentViewer';
import LinkedResourceList from './LinkedResourceList';
import VerifiableMetadataViewer from './VerifiableMetadataViewer';
import CredentialDetails from './verification/CredentialDetails';
import { DidDocument, LinkedResource } from 'ordinalsplus';
import { useNetwork } from '../context/NetworkContext';
import { useApi } from '../context/ApiContext';
import { VerificationResult, VerificationStatus } from '../types/verification';
import { env } from '../config/envConfig';

// Simple Label component with proper types (unused for now but kept for reference)
/* interface LabelProps {
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}

const Label = ({ htmlFor, children, className = '' }: LabelProps) => (
  <label htmlFor={htmlFor} className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 ${className}`}>
    {children}
  </label>
); */

// Simple Pagination component with proper types (unused for now but kept for reference)
/* interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
}

const Pagination = ({ currentPage, totalPages, onPageChange, siblingCount = 1 }: PaginationProps) => {
  const pages = [];
  
  // Add previous button
  pages.push(
    <button
      key="prev"
      onClick={() => currentPage > 0 && onPageChange(currentPage - 1)}
      disabled={currentPage === 0}
      className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 flex items-center justify-center"
    >
      <ChevronLeft className="h-4 w-4" />
    </button>
  );
  
  // Calculate page numbers to show
  const pageNumbers = [];
  
  // Always show first page
  pageNumbers.push(0);
  
  // Calculate start and end
  const startPage = Math.max(1, currentPage - siblingCount);
  const endPage = Math.min(totalPages - 2, currentPage + siblingCount);
  
  // Add ellipsis after first page if needed
  if (startPage > 1) {
    pageNumbers.push(-1); // -1 represents ellipsis
  }
  
  // Add middle pages
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }
  
  // Add ellipsis before last page if needed
  if (endPage < totalPages - 2) {
    pageNumbers.push(-2); // -2 represents ellipsis
  }
  
  // Always show last page if there is more than one page
  if (totalPages > 1) {
    pageNumbers.push(totalPages - 1);
  }
  
  // Add page buttons
  pageNumbers.forEach(pageNum => {
    if (pageNum < 0) {
      // Ellipsis
      pages.push(
        <span key={`ellipsis${pageNum}`} className="px-3 py-1">
          &hellip;
        </span>
      );
    } else {
      pages.push(
        <button
          key={pageNum}
          onClick={() => onPageChange(pageNum)}
          disabled={currentPage === pageNum}
          className={`px-3 py-1 rounded border ${
            currentPage === pageNum 
              ? 'bg-blue-500 text-white border-blue-500' 
              : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          {pageNum + 1}
        </button>
      );
    }
  });
  
  // Add next button
  pages.push(
    <button
      key="next"
      onClick={() => currentPage < totalPages - 1 && onPageChange(currentPage + 1)}
      disabled={currentPage === totalPages - 1}
      className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 flex items-center justify-center"
    >
      <ChevronRight className="h-4 w-4" />
    </button>
  );
  
  return (
    <div className="flex space-x-2">
      {pages}
    </div>
  );
}; */

interface DidExplorerProps {
  onResourceSelect?: (resource: LinkedResource) => void;
}

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

// Interface for ordinals plus resources from indexer
interface OrdinalsInscription {
  inscriptionId: string;
  inscriptionNumber: number;
  resourceId: string;
  ordinalsType: string;
  contentType: string;
  network?: string;
  indexedAt: number;
  contentUrl: string;
  inscriptionUrl: string;
  metadataUrl: string;
  blockHeight?: number | null;
  blockTime?: string | null;
}

interface IndexerStats {
  totalOrdinalsPlus: number;
  lastUpdated: string | null;
  indexerVersion: string;
}

interface OrdinalsIndexResponse {
  success: boolean;
  data: {
    inscriptions: OrdinalsInscription[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    stats: IndexerStats;
  };
}

const DidExplorer: React.FC<DidExplorerProps> = ({ onResourceSelect }: DidExplorerProps) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [didDocument, setDidDocument] = useState<DidDocument | null>(null);
  const [didString, setDidString] = useState<string>('');
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
  const [_, setCurrentPage] = useState(0);
  const [__, setTotalPages] = useState(0);
  const { network } = useNetwork();
  const { apiService } = useApi();
  const [showRawMetadata, setShowRawMetadata] = useState<Record<string, boolean>>({});
  const [verificationResults, setVerificationResults] = useState<Record<string, VerificationResult>>({});
  const [searchParams] = useSearchParams();

  // Ordinals Plus Resources state
  const [ordinalsInscriptions, setOrdinalsInscriptions] = useState<OrdinalsInscription[]>([]);
  const [ordinalsStats, setOrdinalsStats] = useState<IndexerStats | null>(null);
  const [ordinalsPagination, setOrdinalsPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [ordinalsLoading, setOrdinalsLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [ordinalsError, setOrdinalsError] = useState<string | null>(null);
  const [currentOrdinalsPage, setCurrentOrdinalsPage] = useState(1);
  const [showOrdinalsSection, setShowOrdinalsSection] = useState(true);
  const limit = 20; // Items per page for ordinals

  const handleVerificationComplete = (inscriptionId: string, result: VerificationResult) => {
    setVerificationResults(prev => ({
      ...prev,
      [inscriptionId]: result
    }));
  };

  // Load ordinals plus resources from indexer
  const loadOrdinalsInscriptions = async (page = currentOrdinalsPage) => {
    if (!apiService) return;
    
    setOrdinalsLoading(true);
    setOrdinalsError(null);
    
    try {
      const netParam = network?.type ? `&network=${encodeURIComponent(network.type)}` : '';
      const response = await fetch(`${env.VITE_BACKEND_URL}/api/indexer/ordinals-plus?page=${page}&limit=${limit}&sort=${sortOrder}${netParam}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json() as OrdinalsIndexResponse;
      
      console.log('API Response:', result); // Debug logging
      
      if (result.success) {
        console.log('Inscriptions loaded:', result.data.inscriptions); // Debug logging
        setOrdinalsInscriptions(result.data.inscriptions);
        setOrdinalsStats(result.data.stats);
        setOrdinalsPagination(result.data.pagination);
      } else {
        throw new Error('Failed to load ordinals inscriptions - API returned unsuccessful response');
      }
    } catch (err) {
      console.error('Error loading ordinals plus resources:', err);
      setOrdinalsError(err instanceof Error ? err.message : 'Failed to load ordinals plus resources');
    } finally {
      setOrdinalsLoading(false);
    }
  };

  const handleOrdinalsPageChange = (page: number) => {
    setCurrentOrdinalsPage(page);
  };

  // Load ordinals resources on component mount and when page changes
  React.useEffect(() => {
    if (showOrdinalsSection) {
      loadOrdinalsInscriptions();
    }
  }, [currentOrdinalsPage, apiService, showOrdinalsSection, sortOrder, network?.type]);

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleString();
  };

  // Simplified content preview for the main explorer
  const renderContentPreview = (inscription: OrdinalsInscription) => {
    // Debug logging to understand content types
    console.log(`[ContentPreview] Inscription ${inscription.inscriptionId}:`, {
      contentType: inscription.contentType,
      inscriptionNumber: inscription.inscriptionNumber,
      ordinalsType: inscription.ordinalsType
    });

    // Check if it's an image - be more permissive with detection
    const isImage = inscription.contentType && 
      (inscription.contentType.startsWith('image/') || 
       inscription.contentType.includes('png') || 
       inscription.contentType.includes('jpg') || 
       inscription.contentType.includes('jpeg') || 
       inscription.contentType.includes('gif') || 
       inscription.contentType.includes('svg'));

    if (isImage) {
      console.log(`[ContentPreview] Rendering as image: ${inscription.inscriptionId}`);
      return (
        <div className="relative flex justify-center">
          <div className="relative w-24 h-24 border border-gray-300 dark:border-gray-500 rounded bg-gray-50 dark:bg-gray-800">
            <img
              src={inscription.contentUrl}
              alt={`Inscription ${inscription.inscriptionId}`}
              className="absolute inset-0 w-full h-full object-contain"
              onLoad={() => {
                console.log(`✅ Image loaded successfully: ${inscription.inscriptionId}`);
              }}
              onError={(e) => {
                console.error(`❌ Image failed to load: ${inscription.inscriptionId}`);
                const target = e.target as HTMLImageElement;
                const container = target.parentElement;
                if (container) {
                  container.innerHTML = `
                    <iframe
                      src=\"${inscription.contentUrl}\"
                      class=\"absolute inset-0 w-full h-full border-0 rounded\"
                      sandbox=\"allow-same-origin\"
                      title=\"Content of ${inscription.inscriptionId}\"
                    ></iframe>
                  `;
                }
              }}
            />
            <div className="absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1 rounded">
              {inscription.contentType || 'unknown'}
            </div>
          </div>
        </div>
      );
    }
    
    // For non-images, use iframe
    console.log(`[ContentPreview] Rendering as iframe: ${inscription.inscriptionId}`);
    return (
      <div className="relative flex justify-center">
        <div className="relative w-24 h-24 border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700">
          <iframe
            src={inscription.contentUrl}
            className="absolute inset-0 w-full h-full rounded"
            sandbox="allow-scripts allow-same-origin"
            title={`Content of ${inscription.inscriptionId}`}
          />
        </div>
      </div>
    );
  };

  // Function to properly render inscription content based on content type
  const renderInscriptionContent = (inscription: { 
    content: string; 
    contentUrl?: string; 
    contentType?: string;
    inscriptionId: string;
  }) => {
    console.log(`[DidExplorer] Rendering content for inscription ${inscription.inscriptionId}:`, {
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
        console.log(`[DidExplorer] Detected PNG from content signature for ${inscription.inscriptionId}`);
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

    console.log(`[DidExplorer] Final detected content type for ${inscription.inscriptionId}: ${detectedContentType}`);

    // For images, if we have a contentUrl, always try to render as image first
    if ((detectedContentType.startsWith('image/') || 
         inscription.content?.startsWith('PNG') ||
         inscription.content?.startsWith('iVBORw0KGgo')) && 
        inscription.contentUrl) {
      
      console.log(`[DidExplorer] Attempting to render image for ${inscription.inscriptionId} with URL: ${inscription.contentUrl}`);
      
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
      // Default text content display
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
    setShowOrdinalsSection(false);

    // Update search query to show what we're resolving
    setSearchQuery(didToResolve.trim());

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
          setDidString(didToResolve.trim());
          setTotalPages(1);
          setCurrentPage(0);
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
          if (searchQuery.includes('sig:')) {
            setError(
              `DID not found: ${searchQuery.trim()}\n\n` +
              'For signet network:\n' +
              '• Make sure your local ord node is running on http://127.0.0.1:80\n' +
              '• Verify the satoshi number has inscriptions\n' +
              '• Check that the inscription contains a valid BTCO DID document'
            );
          } else {
            setError(`DID not found: ${searchQuery.trim()}`);
          }
        } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
          setError(
            'Server error occurred while resolving DID. This might be due to the BTCO DID resolution implementation being incomplete. ' +
            'Please try again later or contact support if the issue persists.'
          );
        } else if (errorMessage.includes('Failed to connect') || errorMessage.includes('ECONNREFUSED')) {
          if (searchQuery.includes('sig:')) {
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
    } finally {
      setIsLoading(false);
    }
  };

  // Wrapper function for the search input and button
  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    navigate(`/did/${encodeURIComponent(searchQuery.trim())}`);
  };

  // Handle URL search parameters - navigate to DID page if search param is provided
  React.useEffect(() => {
    const searchParam = searchParams.get('search');
    if (searchParam && searchParam.trim() !== '') {
      // Navigate to the DID page instead of resolving here
      navigate(`/did/${encodeURIComponent(searchParam.trim())}`);
    }
  }, [searchParams, navigate]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
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
              <div className="flex items-center gap-2">
                <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono">
                  {metadata.satNumber}
                </code>
                <a
                  href={`https://ordiscan.com/sat/${metadata.satNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
          
          {metadata.totalInscriptions && (
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Total Inscriptions:</span>
              <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono ml-2">
                {metadata.totalInscriptions}
              </code>
            </div>
          )}
          
          {metadata.contentType && (
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Content Type:</span>
              <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono ml-2">
                {metadata.contentType}
              </code>
            </div>
          )}
          
          {metadata.deactivated && (
            <div className="col-span-2">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <XCircle className="w-4 h-4" />
                <span className="font-medium">DID Status: Deactivated</span>
              </div>
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
                                {typeof inscription.metadata.issuer === 'string' ? inscription.metadata.issuer : inscription.metadata.issuer.id || 'Unknown'}
                              </div>
                            </div>
                          )}
                          
                          {inscription.metadata.issuanceDate && (
                            <div>
                              <span className="font-medium text-blue-700 dark:text-blue-300">Issued:</span>
                              <div className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                                {new Date(inscription.metadata.issuanceDate).toLocaleDateString()}
                              </div>
                            </div>
                          )}
                          
                          {inscription.metadata.expirationDate && (
                            <div>
                              <span className="font-medium text-blue-700 dark:text-blue-300">Expires:</span>
                              <div className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                                {new Date(inscription.metadata.expirationDate).toLocaleDateString()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Raw Metadata Display */}
                      {showRawMetadata[inscription.inscriptionId] && (
                        <div className="p-2 bg-gray-100 dark:bg-gray-600 rounded text-xs font-mono break-all max-h-40 overflow-y-auto">
                          {JSON.stringify(inscription.metadata, null, 2)}
                        </div>
                      )}
                    </div>

                    {/* Credential Details (only shown for valid credentials) */}
                    {verificationResults[inscription.inscriptionId]?.credential && 
                     verificationResults[inscription.inscriptionId]?.status === VerificationStatus.VALID && (
                      <div className="border-t pt-4">
                        <CredentialDetails
                          credential={verificationResults[inscription.inscriptionId].credential!}
                          issuer={verificationResults[inscription.inscriptionId].issuer}
                          defaultExpanded={true}
                          className="w-full"
                        />
                      </div>
                    )}

                    {inscription.error && (
                      <div>
                        <span className="font-medium text-red-600 dark:text-red-400">Error:</span>
                        <div className="text-red-600 dark:text-red-400 text-xs ml-2">
                          {inscription.error}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
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

                  {inscription.error && (
                    <div>
                      <span className="font-medium text-red-600 dark:text-red-400">Error:</span>
                      <div className="text-red-600 dark:text-red-400 text-xs ml-2">
                        {inscription.error}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render ordinals plus resources section
  const renderOrdinalsSection = () => {
    if (!showOrdinalsSection) return null;

    return (
      <div className="space-y-6 mb-8">
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <List className="w-6 h-6 text-blue-500" />
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
              Recent Ordinals Plus Resources
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder((e.target.value as 'asc' | 'desc') || 'desc')}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              aria-label="Sort order"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
            <button
              onClick={() => setShowOrdinalsSection(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats */}
        {ordinalsStats && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200 block">Total Ordinals Plus</span>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{ordinalsStats.totalOrdinalsPlus.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200 block">Last Updated</span>
                <p className="text-sm text-blue-700 dark:text-blue-300">{formatTimestamp(ordinalsStats.lastUpdated)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {ordinalsLoading && ordinalsInscriptions.length === 0 && (
          <div className="text-center py-8">
            <RotateCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">Loading ordinals plus resources...</p>
          </div>
        )}

        {/* Error State */}
        {ordinalsError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium">Failed to Load Resources</h4>
              <p className="mt-1">{ordinalsError}</p>
              <button
                onClick={() => loadOrdinalsInscriptions(currentOrdinalsPage)}
                className="mt-2 text-sm bg-red-100 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-700 px-3 py-1 rounded transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!ordinalsLoading && !ordinalsError && ordinalsInscriptions.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl text-gray-300 dark:text-gray-600 mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No Ordinals Plus Resources Found</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              The indexer hasn't found any inscriptions with Verifiable Credentials or DID Documents yet.
            </p>
          </div>
        )}

        {/* Resources List */}
        {ordinalsInscriptions.length > 0 && (
          <div className="space-y-4">
            {ordinalsInscriptions.map((inscription) => {
              // Function to handle navigation (shared logic)
              const navigateToDid = () => {
                // Extract the DID from the resourceId (remove the /0 suffix if present)
                const resourceId = inscription.resourceId;
                const did = resourceId.includes('/') ? resourceId.split('/')[0] : resourceId;
                
                // Navigate to the DID page
                navigate(`/did/${encodeURIComponent(did)}`);
              };

              // Function to handle card click navigation
              const handleCardClick = (e: React.MouseEvent) => {
                // Don't navigate if clicking on links or buttons
                if ((e.target as HTMLElement).closest('a, button')) {
                  return;
                }
                
                navigateToDid();
              };

              // Keyboard handler
              const handleKeyDown = (e: React.KeyboardEvent) => {
                if (e.key === 'Enter') {
                  navigateToDid();
                }
              };

              return (
                <div 
                  key={inscription.inscriptionId} 
                  className="border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500 transition-all cursor-pointer"
                  onClick={handleCardClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={handleKeyDown}
                >
                  <div className="flex">
                    {/* Left side - Content */}
                    <div className="flex-1 p-4 border-r border-gray-200 dark:border-gray-600">
                      <div className="h-32 overflow-hidden">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Content Preview:</div>
                        {renderContentPreview(inscription)}
                      </div>
                    </div>
                    
                    {/* Right side - Metadata */}
                    <div className="flex-1 p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            inscription.ordinalsType === 'did-document' 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100'
                              : inscription.ordinalsType === 'verifiable-credential'
                              ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100'
                          }`}>
                            {inscription.ordinalsType === 'did-document' ? 'DID Document' : 
                             inscription.ordinalsType === 'verifiable-credential' ? 'Verifiable Credential' : 
                             `Unknown (${inscription.ordinalsType || 'undefined'})`}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            inscription.network === 'signet' 
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-100'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100'
                          }`}>
                            {inscription.network || 'mainnet'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Resource ID (DID):</span>
                          <p className="text-sm text-gray-900 dark:text-gray-100 font-mono break-all">
                            {inscription.resourceId}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Mined:</span>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {inscription.blockTime
                              ? formatTimestamp(inscription.blockTime)
                              : (typeof inscription.blockHeight === 'number' && inscription.blockHeight > 0
                                  ? `Block ${new Intl.NumberFormat(undefined).format(inscription.blockHeight)}`
                                  : 'Unknown')}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <a
                          href={inscription.contentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-500 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View Content
                        </a>
                        {/* Show appropriate action button based on resource type */}
                        {inscription.ordinalsType === 'did-document' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent card click
                              // Extract the DID from the resourceId (remove the /0 suffix if present)
                              const resourceId = inscription.resourceId;
                              const did = resourceId.includes('/') ? resourceId.split('/')[0] : resourceId;
                              
                              // Navigate to the DID page
                              navigate(`/did/${encodeURIComponent(did)}`);
                            }}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                          >
                            Explore DID
                          </button>
                        )}
                        {inscription.ordinalsType === 'verifiable-credential' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent card click
                              // Extract the DID from the resourceId (remove the /0 suffix)
                              const resourceId = inscription.resourceId;
                              const did = resourceId.split('/')[0]; // Get DID part before /0
                              
                              // Navigate to the DID page
                              navigate(`/did/${encodeURIComponent(did)}`);
                            }}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors"
                          >
                            <Shield className="w-4 h-4 mr-1" />
                            Verify Credential
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Pagination */}
            {ordinalsPagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                <button
                  onClick={() => handleOrdinalsPageChange(ordinalsPagination.page - 1)}
                  disabled={!ordinalsPagination.hasPrev || ordinalsLoading}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {ordinalsPagination.page} of {ordinalsPagination.totalPages}
                </span>
                
                <button
                  onClick={() => handleOrdinalsPageChange(ordinalsPagination.page + 1)}
                  disabled={!ordinalsPagination.hasNext || ordinalsLoading}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb when viewing resolved DID */}
      {(didDocument || resolutionResult) && (
        <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">
              Viewing resolved DID: <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-sm">{didString}</code>
            </span>
          </div>
        </div>
      )}

      {/* Search Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
          Ordinals+ Explorer
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {didDocument ? 
            "DID Document and Resources" :
            "Enter an Ordinals+ identifier to resolve it according to the BTCO DID Method Specification"
          }
        </p>
      </div>

      {/* Search Input */}
      <div className="flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={didDocument ? `Currently viewing: ${didString}` : "Enter BTCO DID (e.g., did:btco:1908770696977240)"}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-lg"
            disabled={!!didDocument}
          />
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {didDocument ? 
              "Click 'Back to Explorer' to search for another DID" : 
              "Supported formats: did:btco:<satoshi>, did:btco:test:<satoshi>, did:btco:sig:<satoshi>"
            }
          </div>
        </div>
        {/* Show Back button when viewing a resolved DID */}
        {(didDocument || resolutionResult) ? (
          <button
            onClick={() => {
              // Clear all search results and return to explorer view
              setSearchQuery('');
              setDidDocument(null);
              setResolutionResult(null);
              setAllInscriptions(null);
              setError(null);
              setShowOrdinalsSection(true);
            }}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Explorer
          </button>
        ) : (
          <button
            onClick={handleSearch}
            disabled={isLoading || !searchQuery.trim()}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <RotateCw className="w-5 h-5 animate-spin" />
                Resolving...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Resolve
              </>
            )}
          </button>
        )}
      </div>

      {/* Ordinals Plus Resources Section */}
      {!didDocument && !resolutionResult && renderOrdinalsSection()}

      {/* Show collapsed section toggle when hidden */}
      {!showOrdinalsSection && !didDocument && !resolutionResult && (
        <div className="mb-6">
          <button
            onClick={() => setShowOrdinalsSection(true)}
            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <List className="w-4 h-4" />
            Show Recent Ordinals Plus Resources
          </button>
        </div>
      )}

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
            did={didString}
            onResourceSelect={onResourceSelect || (() => {})}
          />
        </div>
      )}
    </div>
  );
};

export default DidExplorer;
