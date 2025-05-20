import React, { useState } from 'react';
import CollectionCreationForm from '../components/collection/CollectionCreationForm';

/**
 * Page component for creating a new collection
 */
const CreateCollectionPage: React.FC = () => {
  // Mock authentication state for development
  // We're not using isAuthenticated in this simplified version, but keeping it for reference
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isAuthenticated] = useState(true);
  const [userDids] = useState([
    'did:ord:btc:xyzabc123456789',
    'did:ord:btc:987654321abcdef'
  ]);
  const [error] = useState<string | null>(null);

  // In a real implementation, we would use the auth context
  // const { isAuthenticated, userDids } = useAuth();
  // const [error, setError] = useState<string | null>(null);
  // useEffect(() => {
  //   if (!isAuthenticated) {
  //     setError('You must be logged in to create a collection.');
  //   } else if (!userDids || userDids.length === 0) {
  //     setError('You need at least one DID to create a collection.');
  //   } else {
  //     setError(null);
  //   }
  // }, [isAuthenticated, userDids]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="my-8">
        <h1 className="text-2xl font-bold mb-2">
          Create Curated Collection
        </h1>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Create a curated collection of inscriptions with verifiable credentials.
          Collections can be inscribed on-chain and shared with others.
        </p>
        
        {error ? (
          <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg" role="alert">
            {error}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <CollectionCreationForm userDids={userDids || []} />
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateCollectionPage;
