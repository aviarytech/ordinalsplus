import React, { useState, useEffect } from 'react';
import { useApiService } from '../hooks/useApiService';

interface OrdinalsInscription {
  inscriptionId: string;
  inscriptionNumber: number;
  contentUrl: string;
  inscriptionUrl: string;
  metadataUrl: string;
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

export const OrdinalsIndexPage: React.FC = () => {
  const apiService = useApiService();
  const [inscriptions, setInscriptions] = useState<OrdinalsInscription[]>([]);
  const [stats, setStats] = useState<IndexerStats | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrdinalsPlus = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const apiUrl = apiService.getConfig().baseUrl;
      const response = await fetch(`${apiUrl}/api/indexer/ordinals-plus?page=${page}&limit=${pagination.limit}`);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data: OrdinalsIndexResponse = await response.json();
      
      if (!data.success) {
        throw new Error('API returned unsuccessful response');
      }
      
      setInscriptions(data.data.inscriptions);
      setPagination(data.data.pagination);
      setStats(data.data.stats);
      
    } catch (err) {
      console.error('Error fetching Ordinals Plus inscriptions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch inscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdinalsPlus(1);
  }, [apiService]);

  const handlePageChange = (newPage: number) => {
    fetchOrdinalsPlus(newPage);
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleString();
  };

  if (loading && inscriptions.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Ordinals Plus inscriptions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Inscriptions</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => fetchOrdinalsPlus(pagination.page)}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Ordinals Plus Index</h1>
        <p className="text-gray-600 mb-6">
          Discover inscriptions with Verifiable Credentials and DID Documents stored as CBOR metadata.
        </p>
        
        {/* Stats */}
        {stats && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-sm font-medium text-blue-800">Total Ordinals Plus</span>
                <p className="text-2xl font-bold text-blue-900">{stats.totalOrdinalsPlus}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-blue-800">Last Updated</span>
                <p className="text-sm text-blue-700">{formatTimestamp(stats.lastUpdated)}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-blue-800">Indexer Version</span>
                <p className="text-sm text-blue-700">{stats.indexerVersion}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inscriptions List */}
      {inscriptions.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl text-gray-300 mb-4">📜</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Ordinals Plus Inscriptions Found</h3>
          <p className="text-gray-500">The indexer hasn't found any Verifiable Credentials or DID Documents yet.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6">
            {inscriptions.map((inscription) => (
              <div key={inscription.inscriptionId} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Inscription #{inscription.inscriptionNumber}
                      </h3>
                      <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        {inscription.inscriptionId}
                      </code>
                    </div>
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                      Ordinals Plus
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={inscription.contentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      📄 View Content
                    </a>
                    <a
                      href={inscription.inscriptionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      🔍 View Details
                    </a>
                    <a
                      href={inscription.metadataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-sm font-medium rounded text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      🏷️ View Metadata
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-8 flex justify-center items-center space-x-4">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={!pagination.hasPrev || loading}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              
              <span className="text-sm text-gray-700">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={!pagination.hasNext || loading}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Refresh Button */}
      <div className="mt-8 text-center">
        <button
          onClick={() => fetchOrdinalsPlus(pagination.page)}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}; 