import React, { useState, useEffect } from 'react';
import { collectionService } from '../../services/collectionService';

interface Inscription {
  did: string;
  id: string;
  title: string;
  thumbnailUrl: string;
  contentType?: string;
}

// Removed unused DragResult interface

interface InscriptionSelectorProps {
  userDid: string;
  selectedItems: string[];
  onSelectionChange: (selectedDids: string[]) => void;
}

/**
 * Component for selecting and ordering inscriptions for a collection
 */
export const InscriptionSelector: React.FC<InscriptionSelectorProps> = ({
  userDid,
  selectedItems,
  onSelectionChange
}) => {
  const [availableInscriptions, setAvailableInscriptions] = useState<Inscription[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [orderedSelectedItems, setOrderedSelectedItems] = useState<string[]>(selectedItems);

  // Fetch available inscriptions when the component mounts or userDid changes
  useEffect(() => {
    const fetchInscriptions = async () => {
      try {
        setLoading(true);
        const inscriptions = await collectionService.getAvailableInscriptions(userDid);
        setAvailableInscriptions(inscriptions);
        setError(null);
      } catch (err) {
        console.error('Error fetching inscriptions:', err);
        setError('Failed to load inscriptions. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (userDid) {
      fetchInscriptions();
    }
  }, [userDid]);

  // Update ordered items when selectedItems changes
  useEffect(() => {
    // Keep the order of existing items and add new ones at the end
    const newOrderedItems = [...orderedSelectedItems];
    
    // Add any newly selected items that aren't in the ordered list
    selectedItems.forEach(item => {
      if (!newOrderedItems.includes(item)) {
        newOrderedItems.push(item);
      }
    });
    
    // Remove any items that are no longer selected
    const filteredOrderedItems = newOrderedItems.filter(item => selectedItems.includes(item));
    
    setOrderedSelectedItems(filteredOrderedItems);
  }, [selectedItems]);

  // Toggle selection of an inscription
  const toggleItemSelection = (did: string) => {
    const newSelectedItems = selectedItems.includes(did)
      ? selectedItems.filter(item => item !== did)
      : [...selectedItems, did];
    
    onSelectionChange(newSelectedItems);
  };

  // Handle manual reordering (simplified without drag-drop library)
  const moveItem = (fromIndex: number, toIndex: number) => {
    const items = Array.from(orderedSelectedItems);
    const [reorderedItem] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, reorderedItem);
    
    setOrderedSelectedItems(items);
    onSelectionChange(items);
  };
  
  // Move item up in the list
  const moveItemUp = (index: number) => {
    if (index > 0) {
      moveItem(index, index - 1);
    }
  };
  
  // Move item down in the list
  const moveItemDown = (index: number) => {
    if (index < orderedSelectedItems.length - 1) {
      moveItem(index, index + 1);
    }
  };

  // Filter inscriptions based on search query
  const filteredInscriptions = availableInscriptions.filter(inscription => 
    inscription.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inscription.did.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            className="w-full p-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Search inscriptions..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          />
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-2">
        Available Inscriptions
      </h3>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 inscription-grid">
        {filteredInscriptions.map(inscription => (
          <div key={inscription.did} className="col-span-1">
            <div 
              className={`p-2 bg-white dark:bg-gray-800 rounded-lg shadow cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${selectedItems.includes(inscription.did) ? 'ring-2 ring-orange-500' : 'border-2 border-transparent'}`}
              onClick={() => toggleItemSelection(inscription.did)}
            >
              <img
                src={inscription.thumbnailUrl}
                alt={inscription.title || 'Inscription'}
                className="w-full h-36 object-cover rounded"
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                  e.currentTarget.src = '/placeholder-image.png';
                }}
              />
              <div className="mt-2 text-sm truncate">
                {inscription.title || inscription.did.substring(0, 15) + '...'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedItems.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-2">
            Selected Items (Drag to Reorder)
          </h3>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            {orderedSelectedItems.map((did, index) => {
              const inscription = availableInscriptions.find(insc => insc.did === did);
              if (!inscription) return null;
              
              return (
                <div 
                  key={did} 
                  className="flex items-center p-2 mb-2 bg-gray-50 dark:bg-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  <div className="flex-1 flex items-center">
                    <img
                      src={inscription.thumbnailUrl}
                      alt={inscription.title || 'Inscription'}
                      className="w-10 h-10 object-cover rounded mr-3"
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        e.currentTarget.src = '/placeholder-image.png';
                      }}
                    />
                    <div className="truncate">
                      {inscription.title || inscription.did.substring(0, 20) + '...'}
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <button 
                      type="button" 
                      className="p-1 text-gray-500 hover:text-orange-500 disabled:opacity-30"
                      onClick={() => moveItemUp(index)}
                      disabled={index === 0}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button 
                      type="button" 
                      className="p-1 text-gray-500 hover:text-orange-500 disabled:opacity-30"
                      onClick={() => moveItemDown(index)}
                      disabled={index === orderedSelectedItems.length - 1}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default InscriptionSelector;
