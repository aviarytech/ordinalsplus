import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collectionService, CollectionCategory, CollectionVisibility, CreateCollectionParams } from '../../services/collectionService';
// Import the InscriptionSelector component
import InscriptionSelector from './InscriptionSelector';

interface CollectionCreationFormProps {
  userDids: string[];
}

/**
 * Form component for creating a new curated collection
 */
export const CollectionCreationForm: React.FC<CollectionCreationFormProps> = ({ userDids }) => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CollectionCategory>(CollectionCategory.OTHER);
  const [visibility, setVisibility] = useState<CollectionVisibility>(CollectionVisibility.PUBLIC);
  const [tags, setTags] = useState<string>('');
  const [curatorDid, setCuratorDid] = useState<string>(userDids[0] || '');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  
  // Form validation
  const [nameError, setNameError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);

  // Options for select fields
  const categoryOptions = collectionService.getCollectionCategories();
  const visibilityOptions = collectionService.getCollectionVisibilityOptions();

  // Set default curator DID when userDids changes
  useEffect(() => {
    if (userDids.length > 0 && !curatorDid) {
      setCuratorDid(userDids[0]);
    }
  }, [userDids, curatorDid]);

  // Validate form fields
  const validateForm = (): boolean => {
    let isValid = true;
    
    // Validate name
    if (!name.trim()) {
      setNameError('Collection name is required');
      isValid = false;
    } else if (name.length > 100) {
      setNameError('Collection name must be less than 100 characters');
      isValid = false;
    } else {
      setNameError(null);
    }
    
    // Validate description
    if (!description.trim()) {
      setDescriptionError('Description is required');
      isValid = false;
    } else if (description.length > 1000) {
      setDescriptionError('Description must be less than 1000 characters');
      isValid = false;
    } else {
      setDescriptionError(null);
    }
    
    // Validate selected items
    if (selectedItems.length === 0) {
      setItemsError('At least one inscription must be selected');
      isValid = false;
    } else {
      setItemsError(null);
    }
    
    return isValid;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Prepare collection items with order
      const items = selectedItems.map((did, index) => ({
        did,
        order: index
      }));
      
      // Parse tags
      const tagArray = tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      // Create collection params
      const collectionParams: CreateCollectionParams = {
        name,
        description,
        category,
        visibility,
        curatorDid,
        tags: tagArray,
        items
      };
      
      // Call API to create collection
      const result = await collectionService.createCollection(collectionParams);
      
      setSuccess(`Collection "${name}" created successfully!`);
      
      // Navigate to the collection view page after a short delay
      setTimeout(() => {
        navigate(`/collections/${result.id}`);
      }, 2000);
      
    } catch (err: any) {
      console.error('Error creating collection:', err);
      setError(err.message || 'Failed to create collection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle step navigation
  const handleNext = () => {
    if (activeStep === 0) {
      if (name.trim() && description.trim()) {
        setActiveStep(1);
      } else {
        validateForm();
      }
    } else if (activeStep === 1) {
      if (selectedItems.length > 0) {
        setActiveStep(2);
      } else {
        setItemsError('At least one inscription must be selected');
      }
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  // Steps for the collection creation process
  const steps = [
    'Collection Details',
    'Select Inscriptions',
    'Review & Create'
  ];

  // Render step content
  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Collection Details
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Collection Name*
                </label>
                <input
                  type="text"
                  className={`w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${nameError ? 'border-red-500' : 'border-gray-300'}`}
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  required
                />
                {nameError && <p className="mt-1 text-sm text-red-500">{nameError}</p>}
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description*
                </label>
                <textarea
                  className={`w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${descriptionError ? 'border-red-500' : 'border-gray-300'}`}
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  rows={4}
                  required
                />
                {descriptionError && <p className="mt-1 text-sm text-red-500">{descriptionError}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={category}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value as CollectionCategory)}
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Visibility
                </label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={visibility}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVisibility(e.target.value as CollectionVisibility)}
                >
                  {visibilityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {visibility === CollectionVisibility.PUBLIC 
                    ? 'Publicly visible and searchable'
                    : visibility === CollectionVisibility.PRIVATE
                      ? 'Only visible to you and explicitly shared users'
                      : 'Accessible via direct link but not listed in searches'}
                </p>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={tags}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTags(e.target.value)}
                  placeholder="art, bitcoin, ordinals"
                />
                <p className="mt-1 text-xs text-gray-500">Optional: Add tags to help others discover your collection</p>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Curator Identity*
                </label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={curatorDid}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCuratorDid(e.target.value)}
                  required
                >
                  {userDids.map((did) => (
                    <option key={did} value={did}>
                      {did}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Select the DID that will be the curator of this collection</p>
              </div>
            </div>
          </div>
        );
        
      case 1:
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Select Inscriptions
            </h3>
            
            {itemsError && (
              <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg" role="alert">
                {itemsError}
              </div>
            )}
            
            <InscriptionSelector
              userDid={curatorDid}
              selectedItems={selectedItems}
              onSelectionChange={setSelectedItems}
            />
          </div>
        );
        
      case 2:
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Review Collection
            </h3>
            
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300">Collection Name</h4>
                  <p>{name}</p>
                </div>
                
                <hr className="border-gray-200 dark:border-gray-700" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-700 dark:text-gray-300">Category</h4>
                    <p>
                      {categoryOptions.find(opt => opt.value === category)?.label || category}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-700 dark:text-gray-300">Visibility</h4>
                    <p>
                      {visibilityOptions.find(opt => opt.value === visibility)?.label || visibility}
                    </p>
                  </div>
                </div>
                
                <hr className="border-gray-200 dark:border-gray-700" />
                
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300">Description</h4>
                  <p>{description}</p>
                </div>
                
                <hr className="border-gray-200 dark:border-gray-700" />
                
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300">Tags</h4>
                  <p>
                    {tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0).join(', ') || 'None'}
                  </p>
                </div>
                
                <hr className="border-gray-200 dark:border-gray-700" />
                
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300">Curator</h4>
                  <p className="break-all">
                    {curatorDid}
                  </p>
                </div>
                
                <hr className="border-gray-200 dark:border-gray-700" />
                
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300">Selected Items ({selectedItems.length})</h4>
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      {error && (
        <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg" role="alert">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-4 mb-4 text-green-700 bg-green-100 rounded-lg" role="alert">
          {success}
        </div>
      )}
      
      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center">
          {steps.map((label, index) => (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 flex items-center justify-center rounded-full ${index <= activeStep ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {index + 1}
                </div>
                <div className="text-xs mt-1">{label}</div>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-2 ${index < activeStep ? 'bg-orange-500' : 'bg-gray-200'}`}></div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      {getStepContent(activeStep)}
      
      <div className="flex justify-between mt-8">
        <button
          type="button"
          className={`px-4 py-2 rounded ${activeStep === 0 || loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
          disabled={activeStep === 0 || loading}
          onClick={handleBack}
        >
          Back
        </button>
        
        <div>
          {activeStep === steps.length - 1 ? (
            <button
              type="submit"
              className={`px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="inline-block mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Creating...
                </>
              ) : 'Create Collection'}
            </button>
          ) : (
            <button
              type="button"
              className={`px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              onClick={handleNext}
              disabled={loading}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </form>
  );
};

export default CollectionCreationForm;
