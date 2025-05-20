import React, { useState, useEffect } from 'react';
import { useApi } from '../../context/ApiContext';
import { useNetwork } from '../../context/NetworkContext';
import type { FeeEstimateResponse, InscriptionDetailsResponse, NetworkInfo } from '../../types';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useNavigate } from 'react-router-dom';

// Define an interface for LinkedResource until we have proper typings
interface LinkedResource {
  inscriptionId: string;
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
  decimals?: number;
  totalSupply?: number;
  externalUrl?: string;
  [key: string]: any;
}

// Define a type for the items we store, which can be LinkedResource or basic InscriptionDetails
// Also include the original raw data for fallback rendering
type FetchedInscriptionData = 
  | { status: 'linked_resource'; data: LinkedResource; raw: any }
  | { status: 'basic_details'; data: InscriptionDetailsResponse; raw: any }
  | { status: 'fetch_failed'; id: string; raw: any };

// Function to get ID from an inscription data object
function getInscriptionId(inscription: FetchedInscriptionData): string {
  if (inscription.status === 'linked_resource' && inscription.data && inscription.data.inscriptionId) {
    return inscription.data.inscriptionId;
  } else if (inscription.status === 'basic_details' && inscription.data && 'id' in inscription.data) {
    return inscription.data.id as string;
  } else if (inscription.status === 'fetch_failed') {
    return inscription.id;
  } else {
    // Fallback
    return `inscription-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Function to safely get inscription number
function getInscriptionNumber(inscription: InscriptionDetailsResponse): string {
  return ('number' in inscription) ? `#${inscription.number}` : 'Unknown';
}

// Function to check if inscription has content
function hasContent(inscription: InscriptionDetailsResponse): boolean {
  return 'content' in inscription && !!inscription.content;
}

// Function to safely get inscription ID
function getBasicDetailsId(inscription: InscriptionDetailsResponse): string {
  return ('id' in inscription) ? inscription.id as string : 'unknown-id';
}

const OrdinalResourceSchema = Yup.object().shape({
  name: Yup.string().required('Name is required'),
  symbol: Yup.string().required('Symbol is required'),
  description: Yup.string().required('Description is required'),
  image: Yup.string().url('Must be a valid URL').required('Image URL is required'),
  externalUrl: Yup.string().url('Must be a valid URL'),
  totalSupply: Yup.number().integer('Must be an integer').min(1, 'Must be at least 1').required('Total supply is required'),
  decimals: Yup.number().integer('Must be an integer').min(0, 'Cannot be negative').required('Decimals is required'),
});

interface OrdinalResourceFormProps {
  // Any additional props that might be needed
}

const OrdinalResourceForm: React.FC<OrdinalResourceFormProps> = () => {
  // API Service Hook
  const { apiService } = useApi();

  // --- Use Network Context --- 
  const { currentNetwork: currentProviderType } = useNetwork();
  
  // Fee state
  const [feeRate, setFeeRate] = useState(10); 
  const [feeEstimates, setFeeEstimates] = useState<FeeEstimateResponse | null>(null);
  const [loadingFees, setLoadingFees] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [selectedFeeLevel, setSelectedFeeLevel] = useState<'low' | 'medium' | 'high' | 'custom'>('medium');

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  // State for inscriptions
  const [rawInscriptions, setRawInscriptions] = useState<any[]>([]);
  const [fetchedInscriptionData, setFetchedInscriptionData] = useState<FetchedInscriptionData[]>([]);
  const [loadingInscriptions, setLoadingInscriptions] = useState(false);
  const [inscriptionError, setInscriptionError] = useState<string | null>(null);
  const [selectedInscriptionId, setSelectedInscriptionId] = useState<string | null>(null);

  // Network State
  const [availableNetworks, setAvailableNetworks] = useState<NetworkInfo[]>([]);
  const [isLoadingNetworks, setIsLoadingNetworks] = useState(false);
  const [networkFetchError, setNetworkFetchError] = useState<string | null>(null);

  // Sample inscription IDs for testing (these would normally come from the wallet)
  const sampleInscriptionIds = [
    "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0",
    "7d47acdb499f5c2d30f730c2cee52e7d212757e47c5b4f4edbde5dd8bd496b54i0",
    "5ac6891320ac9fc09c13b3a43bd0b5a1aeba7a4cd4879e6e66dd7f22a867c22ei0"
  ];

  // Load sample inscriptions
  useEffect(() => {
    const fetchSampleInscriptions = async () => {
      if (!apiService) return;
      
      setLoadingInscriptions(true);
      setInscriptionError(null);
      setFetchedInscriptionData([]);
      
      try {
        // Process each sample inscription ID
        const fetchPromises = sampleInscriptionIds.map(async (id): Promise<FetchedInscriptionData> => {
          try {
            // First try to get it as a linked resource
            const resourceData = await apiService.getResourceById(id);
            if (resourceData && typeof resourceData === 'object' && resourceData.inscriptionId) {
              return { status: 'linked_resource', data: resourceData as LinkedResource, raw: { id } };
            } else {
              throw new Error('InscriptionNotFound');
            }
          } catch (linkedResourceError: any) {
            // If not a linked resource, try to get basic details
            if (linkedResourceError?.message?.includes('InscriptionNotFound') || 
                linkedResourceError?.message?.includes('404') || 
                linkedResourceError?.message?.includes('not found')) {
              try {
                const detailsData = await apiService.getInscriptionDetails(id);
                return { status: 'basic_details', data: detailsData, raw: { id } };
              } catch (detailsError: any) {
                console.warn(`Failed to get basic details for ${id}:`, detailsError?.message || detailsError);
                return { status: 'fetch_failed', id, raw: { id } };
              }
            } else {
              console.warn(`Failed to get linked resource for ${id}:`, linkedResourceError?.message || linkedResourceError);
              return { status: 'fetch_failed', id, raw: { id } };
            }
          }
        });
        
        const results = await Promise.all(fetchPromises);
        setFetchedInscriptionData(results);
        setRawInscriptions(sampleInscriptionIds.map(id => ({ id })));
      } catch (err) {
        console.error('Error fetching sample inscriptions:', err);
        setInscriptionError('Failed to load sample inscriptions');
      } finally {
        setLoadingInscriptions(false);
      }
    };
    
    fetchSampleInscriptions();
  }, [apiService]);

  // Fetch fees effect
  useEffect(() => {
    if (!apiService) {
      console.warn("ApiService not available yet.");
      return;
    }

    const fetchFees = async () => {
      setLoadingFees(true);
      setFeeError(null);
      try {
        const estimates = await apiService.getFeeEstimates();
        setFeeEstimates(estimates);
        if (estimates?.medium) {
          setFeeRate(estimates.medium);
          setSelectedFeeLevel('medium');
        }
      } catch (err) {
        console.error("Failed to fetch fee estimates:", err);
        setFeeError(err instanceof Error ? err.message : 'Failed to load fees');
      } finally {
        setLoadingFees(false);
      }
    };

    fetchFees();
  }, [apiService]);

  // Fetch Available Networks Effect
  useEffect(() => {
    if (!apiService) { return; }
    const fetchNetworks = async () => {
        setIsLoadingNetworks(true);
        setNetworkFetchError(null);
        setAvailableNetworks([]);
        try {
            const response = await fetch(`${apiService.getConfig().baseUrl}/api/networks`); 
            if (!response.ok) { throw new Error(`HTTP error ${response.status}`); }
            const data: NetworkInfo[] = await response.json();
            setAvailableNetworks(data);
        } catch (err) {
            console.error("Failed to fetch networks:", err);
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            setNetworkFetchError(`Failed to load networks: ${errorMsg}`);
        } finally {
            setIsLoadingNetworks(false);
        }
    };
    fetchNetworks();
  }, [apiService]);

  // Fee selection handlers
  const handleFeeSelection = (level: 'low' | 'medium' | 'high') => {
    if (feeEstimates && feeEstimates[level]) {
      setFeeRate(feeEstimates[level]);
      setSelectedFeeLevel(level);
    }
  };

  const handleCustomFeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setFeeRate(isNaN(value) || value < 1 ? 1 : value);
    setSelectedFeeLevel('custom');
  };

  // Inscription selection
  const handleSelectInscription = (inscriptionId: string) => {
    setSelectedInscriptionId(inscriptionId === selectedInscriptionId ? null : inscriptionId);
  };

  // Form submission
  const handleSubmit = async (values: any) => {
    setIsSubmitting(true);
    try {
      console.log('Form values:', values);
      console.log('Selected inscription:', selectedInscriptionId);
      console.log('Fee rate:', feeRate);
      
      // Here we would typically send the data to our API
      // For now we'll just log it
      
      // Navigate to explorer after submit (placeholder)
      setTimeout(() => {
        navigate('/explorer');
      }, 1500);
      
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Initial values for the form
  const initialValues = {
    name: '',
    symbol: '',
    description: '',
    image: '',
    externalUrl: '',
    totalSupply: 1000,
    decimals: 0,
  };

  // Render inscriptions list
  const renderInscriptions = () => {
    if (loadingInscriptions) {
      return <div className="text-center p-4">Loading inscriptions...</div>;
    }

    if (inscriptionError) {
      return <div className="text-red-500 p-4">{inscriptionError}</div>;
    }

    if (fetchedInscriptionData.length === 0) {
      return <div className="text-center p-4">No inscriptions found</div>;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {fetchedInscriptionData.map((inscription, index) => (
          <div 
            key={inscription.status === 'fetch_failed' ? `failed-${index}` : getInscriptionId(inscription)}
            className={`p-4 border rounded cursor-pointer transition-all ${
              selectedInscriptionId === getInscriptionId(inscription)
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-200 hover:border-blue-300 dark:border-gray-700'
            }`}
            onClick={() => handleSelectInscription(getInscriptionId(inscription))}
          >
            {inscription.status === 'linked_resource' && (
              <>
                <div className="font-bold truncate">{inscription.data.name}</div>
                <div className="text-sm text-gray-500 truncate">{inscription.data.inscriptionId}</div>
                {inscription.data.image && (
                  <img 
                    src={inscription.data.image} 
                    alt={inscription.data.name}
                    className="w-full h-40 object-contain mt-2 rounded"
                  />
                )}
                <div className="mt-2 text-xs text-gray-600">
                  Type: <span className="font-semibold">Linked Resource</span>
                </div>
              </>
            )}
            
            {inscription.status === 'basic_details' && (
              <>
                <div className="font-bold truncate">Inscription {getInscriptionNumber(inscription.data)}</div>
                <div className="text-sm text-gray-500 truncate">{getBasicDetailsId(inscription.data)}</div>
                {hasContent(inscription.data) && (
                  <div className="w-full h-40 bg-gray-100 dark:bg-gray-800 mt-2 rounded flex items-center justify-center overflow-hidden">
                    <span className="text-sm text-gray-500">Content preview not available</span>
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-600">
                  Type: <span className="font-semibold">Basic Inscription</span>
                </div>
              </>
            )}
            
            {inscription.status === 'fetch_failed' && (
              <>
                <div className="font-bold truncate text-red-500">Failed to load</div>
                <div className="text-sm text-gray-500 truncate">{inscription.id}</div>
                <div className="w-full h-40 bg-gray-100 dark:bg-gray-800 mt-2 rounded flex items-center justify-center">
                  <span className="text-sm text-red-500">Data unavailable</span>
                </div>
                <div className="mt-2 text-xs text-red-500">
                  Error loading inscription data
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Create Ordinal Resource</h1>
      <h2 className="text-xl text-gray-600 dark:text-gray-400 mb-6">Define the properties of your resource</h2>
      
      <div className="mt-4 mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
        <p className="text-yellow-800 dark:text-yellow-400">
          Wallet connection is temporarily disabled. Using sample inscriptions for testing.
        </p>
      </div>

      {/* Fee Selection Section */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Transaction Fee Rate</h3>
        
        {loadingFees ? (
          <div className="text-gray-500">Loading fee estimates...</div>
        ) : feeError ? (
          <div className="text-red-500 text-sm">{feeError}</div>
        ) : (
          <>
            <div className="flex space-x-2 mb-4">
              <button
                type="button"
                onClick={() => handleFeeSelection('low')}
                className={`px-3 py-1 rounded text-sm ${
                  selectedFeeLevel === 'low' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}
              >
                Low {feeEstimates?.low ? `(${feeEstimates.low} sat/vB)` : ''}
              </button>
              <button
                type="button"
                onClick={() => handleFeeSelection('medium')}
                className={`px-3 py-1 rounded text-sm ${
                  selectedFeeLevel === 'medium' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}
              >
                Medium {feeEstimates?.medium ? `(${feeEstimates.medium} sat/vB)` : ''}
              </button>
              <button
                type="button"
                onClick={() => handleFeeSelection('high')}
                className={`px-3 py-1 rounded text-sm ${
                  selectedFeeLevel === 'high' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}
              >
                High {feeEstimates?.high ? `(${feeEstimates.high} sat/vB)` : ''}
              </button>
            </div>
            
            <div className="flex items-center">
              <label htmlFor="customFee" className="text-sm mr-3">
                Custom:
              </label>
              <input
                id="customFee"
                type="number"
                value={selectedFeeLevel === 'custom' ? feeRate : ''}
                onChange={handleCustomFeeChange}
                placeholder="sat/vB"
                className="w-24 p-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                min="1"
              />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">sat/vB</span>
            </div>
          </>
        )}
      </div>

      {/* Inscriptions Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Sample Inscriptions</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          These are sample inscriptions for testing. Select one to associate with the resource.
        </p>
        
        {renderInscriptions()}
      </div>

      {/* Form Section */}
      <Formik
        initialValues={initialValues}
        validationSchema={OrdinalResourceSchema}
        onSubmit={handleSubmit}
      >
        {({ isSubmitting: formikSubmitting, errors, touched }) => (
          <Form className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium mb-1" htmlFor="name">
                  Name <span className="text-red-500">*</span>
                </label>
                <Field
                  id="name"
                  name="name"
                  type="text"
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                />
                <ErrorMessage name="name" component="div" className="text-red-500 text-sm mt-1" />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="symbol">
                  Symbol <span className="text-red-500">*</span>
                </label>
                <Field
                  id="symbol"
                  name="symbol"
                  type="text"
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                />
                <ErrorMessage name="symbol" component="div" className="text-red-500 text-sm mt-1" />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="totalSupply">
                  Total Supply <span className="text-red-500">*</span>
                </label>
                <Field
                  id="totalSupply"
                  name="totalSupply"
                  type="number"
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                />
                <ErrorMessage name="totalSupply" component="div" className="text-red-500 text-sm mt-1" />
              </div>
              
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium mb-1" htmlFor="description">
                  Description <span className="text-red-500">*</span>
                </label>
                <Field
                  as="textarea"
                  id="description"
                  name="description"
                  rows={4}
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                />
                <ErrorMessage name="description" component="div" className="text-red-500 text-sm mt-1" />
              </div>
              
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium mb-1" htmlFor="image">
                  Image URL <span className="text-red-500">*</span>
                </label>
                <Field
                  id="image"
                  name="image"
                  type="url"
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                />
                <ErrorMessage name="image" component="div" className="text-red-500 text-sm mt-1" />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="externalUrl">
                  External URL
                </label>
                <Field
                  id="externalUrl"
                  name="externalUrl"
                  type="url"
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                />
                <ErrorMessage name="externalUrl" component="div" className="text-red-500 text-sm mt-1" />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="decimals">
                  Decimals <span className="text-red-500">*</span>
                </label>
                <Field
                  id="decimals"
                  name="decimals"
                  type="number"
                  min="0"
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                />
                <ErrorMessage name="decimals" component="div" className="text-red-500 text-sm mt-1" />
              </div>
              
              <div className="col-span-1 md:col-span-2 mt-4">
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors disabled:opacity-50"
                  disabled={isSubmitting || formikSubmitting}
                >
                  {isSubmitting || formikSubmitting ? 'Creating...' : 'Create Resource'}
                </button>
              </div>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default OrdinalResourceForm; 