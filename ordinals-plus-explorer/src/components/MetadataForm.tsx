import React, { useState } from 'react';

// MetadataForm Integration Notes for Subtask 1.4:
// This component is designed to be integrated into a larger inscription flow.
// A parent component will be responsible for:
// 1. Providing the `onSubmit` callback function. This function will receive the validated
//    `VerifiableMetadata` object when the user submits the form. The parent should handle
//    API calls for DID creation (if `createNewDid` is true), metadata storage, and
//    initiating the inscription process.
// 2. Passing the `userDids` prop (an array of strings) if the user has existing DIDs
//    to select from. If not provided, the option to use an existing DID will be hidden.
// 3. Managing the `isLoading` boolean prop. This should be set to true when the parent
//    is performing asynchronous operations (e.g., API calls after form submission)
//    to disable the submit button and provide user feedback.
// 4. Handling any overall application state related to form data persistence if required
//    beyond what `onSubmit` handles (e.g., saving drafts to local storage or a backend).
//    The `MetadataForm` itself is self-contained regarding its internal field states.
//
// See the conceptual example of a parent component in the development chat/documentation
// for how `MetadataForm` might be used.

// Assuming ui-components is a resolvable module path
// If not, this will need adjustment based on actual project structure
// import { TextField, Switch, Select, Button, Tooltip } from 'ui-components';

// Placeholder imports if ui-components are not yet defined or available
const TextField = (props: any) => <input type="text" {...props} />;
const Switch = (props: any) => <input type="checkbox" {...props} />;
const Select = (props: any) => <select {...props} />;
const Button = (props: any) => <button {...props} />;
const Tooltip = ({ title, children }: any) => <div>{children}<span>{title}</span></div>;


export interface VerifiableMetadata {
  title: string;
  description: string;
  creationDate?: string;
  creator?: string;
  contentType?: string; // Added as per plan
  properties?: Record<string, any>; // For custom key-value pairs
  includeAuthenticity: boolean;
  useDid?: string;
  createNewDid?: boolean;
}

export interface MetadataFormProps {
  onSubmit: (metadata: VerifiableMetadata) => void;
  userDids?: string[]; // Optional as per task, good for cases where no DIDs exist yet
  isLoading: boolean;
}

// Define some constants for validation
const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 1000;

// Type for form errors
// type FormErrors = Partial<Record<keyof VerifiableMetadata | 'property_key' | 'property_value', string>>;
// Adjusted to allow any string key for dynamic property errors
type FormErrors = { [key: string]: string | undefined };

const MetadataForm: React.FC<MetadataFormProps> = ({
  onSubmit,
  userDids = [], // Default to empty array if not provided
  isLoading,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creationDate, setCreationDate] = useState('');
  const [creator, setCreator] = useState('');
  const [contentType, setContentType] = useState('');
  // For custom properties, we'll manage an array of objects
  const [properties, setProperties] = useState<Array<{ key: string, value: string }>>([{ key: '', value: '' }]);
  const [includeAuthenticity, setIncludeAuthenticity] = useState(false);
  const [useDid, setUseDid] = useState<string | undefined>(undefined);
  const [createNewDid, setCreateNewDid] = useState(false);

  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const validateField = (fieldName: keyof VerifiableMetadata | 'property_key' | 'property_value', value: any, index?: number): string => {
    let error = '';
    switch (fieldName) {
      case 'title':
        if (!value) error = 'Title is required.';
        else if (value.length > MAX_TITLE_LENGTH) error = `Title cannot exceed ${MAX_TITLE_LENGTH} characters.`;
        break;
      case 'description':
        if (!value) error = 'Description is required.';
        else if (value.length > MAX_DESCRIPTION_LENGTH) error = `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`;
        break;
      case 'creationDate':
        if (value && isNaN(new Date(value).getTime())) error = 'Invalid date format.';
        break;
      // Add more cases for other fields like creator, contentType if specific validation is needed
      case 'property_key':
        if (properties.length > 1 && !value && typeof index === 'number' && properties[index]?.value) error = 'Property key is required if value is present.';
        break;
      case 'property_value':
        if (!value && typeof index === 'number' && properties[index]?.key) error = 'Property value is required if key is present.';
        break;
      default:
        break;
    }
    return error;
  };

  const handleInputChange = (
    setter: React.Dispatch<React.SetStateAction<any>>,
    fieldName: keyof VerifiableMetadata,
    value: any
  ) => {
    setter(value);
    const error = validateField(fieldName, value);
    setFormErrors(prevErrors => ({ ...prevErrors, [fieldName]: error }));
  };

  const handlePropertyFieldChange = (index: number, field: 'key' | 'value', value: string) => {
    const newProperties = [...properties];
    newProperties[index][field] = value;
    setProperties(newProperties);
    // Validate only if the other part of the pair has some value or if both are empty and it's not the only/first property
    const otherField = field === 'key' ? 'value' : 'key';
    let error = '';
    if (value || newProperties[index][otherField]) { // if either key or value is now filled
        error = validateField(field === 'key' ? 'property_key' : 'property_value', value, index);
    }
    // Clear error if both key and value for this property are now empty (unless it's not the first/only one)
    if (!newProperties[index].key && !newProperties[index].value && properties.length > 1) {
        error = ''; 
    }

    setFormErrors(prev => ({
         ...prev,
        [`property_${field}_${index}`]: error
    }));
  };

  const addPropertyField = () => {
    setProperties([...properties, { key: '', value: '' }]);
  };

  const removePropertyField = (index: number) => {
    const newProperties = properties.filter((_, i) => i !== index);
    setProperties(newProperties);
    // Also remove any errors associated with the removed property fields
    const newErrors = { ...formErrors };
    delete newErrors[`property_key_${index}`];
    delete newErrors[`property_value_${index}`];
    setFormErrors(newErrors);
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    let isValid = true;

    const titleError = validateField('title', title);
    if (titleError) { errors.title = titleError; isValid = false; }

    const descriptionError = validateField('description', description);
    if (descriptionError) { errors.description = descriptionError; isValid = false; }

    if (creationDate) {
      const creationDateError = validateField('creationDate', creationDate);
      if (creationDateError) { errors.creationDate = creationDateError; isValid = false; }
    }

    properties.forEach((prop, index) => {
      if (prop.key || prop.value) { // Only validate if the property row is not entirely empty
        const keyError = validateField('property_key', prop.key, index);
        if (keyError) { errors[`property_key_${index}`] = keyError; isValid = false;}
        const valueError = validateField('property_value', prop.value, index);
        if (valueError) { errors[`property_value_${index}`] = valueError; isValid = false;}
      }
    });
    
    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (validateForm()) {
      const filteredProperties = properties
        .filter(prop => prop.key.trim() !== '' && prop.value.trim() !== '') // Ensure key and value are not just whitespace
        .reduce((acc, prop) => {
          acc[prop.key] = prop.value;
          return acc;
        }, {} as Record<string, any>);

      onSubmit({
        title,
        description,
        creationDate: creationDate || undefined,
        creator: creator || undefined,
        contentType: contentType || undefined,
        properties: Object.keys(filteredProperties).length > 0 ? filteredProperties : undefined,
        includeAuthenticity,
        useDid: useDid || undefined,
        createNewDid: createNewDid && !useDid ? createNewDid : undefined,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="metadata-form">
      <p style={{ fontSize: '0.9em', color: 'gray', marginBottom: '16px' }}>
        Please ensure all information is accurate. Metadata will be permanently stored on the blockchain.
      </p>
      
      <div>
        <Tooltip title="A concise and descriptive title for your inscription.">
          <label htmlFor="title">Title (Required)</label>
        </Tooltip>
        <TextField
          id="title"
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(setTitle, 'title', e.target.value)}
          maxLength={MAX_TITLE_LENGTH}
          aria-invalid={!!formErrors.title}
          aria-describedby={formErrors.title ? "title-error" : undefined}
        />
        {formErrors.title && <span id="title-error" style={{ color: 'red' }}>{formErrors.title}</span>}
      </div>

      <div>
        <Tooltip title="A more detailed explanation of your inscription.">
          <label htmlFor="description">Description (Required)</label>
        </Tooltip>
        <TextField
          id="description"
          value={description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(setDescription, 'description', e.target.value)}
          maxLength={MAX_DESCRIPTION_LENGTH}
          aria-invalid={!!formErrors.description}
          aria-describedby={formErrors.description ? "description-error" : undefined}
        />
        {formErrors.description && <span id="description-error" style={{ color: 'red' }}>{formErrors.description}</span>}
      </div>

      <div>
        <Tooltip title="The date this content was originally created. Optional.">
          <label htmlFor="creationDate">Creation Date</label>
        </Tooltip>
        <TextField
          id="creationDate"
          type="date"
          value={creationDate}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(setCreationDate, 'creationDate', e.target.value)}
          aria-invalid={!!formErrors.creationDate}
          aria-describedby={formErrors.creationDate ? "creationDate-error" : undefined}
        />
        {formErrors.creationDate && <span id="creationDate-error" style={{ color: 'red' }}>{formErrors.creationDate}</span>}
      </div>

      <div>
        <Tooltip title="Name or Decentralized Identifier of the creator. Optional.">
          <label htmlFor="creator">Creator/Artist Name or DID</label>
        </Tooltip>
        <TextField
          id="creator"
          value={creator}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(setCreator, 'creator', e.target.value)}
        />
      </div>
      
      <div>
        <Tooltip title="The MIME type of the content being inscribed (e.g., image/jpeg, text/plain). Optional.">
          <label htmlFor="contentType">Content Type</label>
        </Tooltip>
        <TextField
          id="contentType"
          value={contentType}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(setContentType, 'contentType', e.target.value)}
        />
      </div>

      <div>
        <Tooltip title="Add custom key-value pairs for additional metadata. Both key and value are required if a pair is added.">
          <label>Custom Properties</label>
        </Tooltip>
        {properties.map((prop, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <TextField
              placeholder="Key"
              value={prop.key}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePropertyFieldChange(index, 'key', e.target.value)}
              style={{ marginRight: '8px' }}
              aria-label={`Property Key ${index + 1}`}
              aria-invalid={!!formErrors[`property_key_${index}`]}
              aria-describedby={formErrors[`property_key_${index}`] ? `prop-key-error-${index}` : undefined}
            />
            <TextField
              placeholder="Value"
              value={prop.value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePropertyFieldChange(index, 'value', e.target.value)}
              style={{ marginRight: '8px' }}
              aria-label={`Property Value ${index + 1}`}
              aria-invalid={!!formErrors[`property_value_${index}`]}
              aria-describedby={formErrors[`property_value_${index}`] ? `prop-value-error-${index}` : undefined}
            />
            {properties.length > 1 && (
              <Button type="button" onClick={() => removePropertyField(index)}>Remove</Button>
            )}
            {formErrors[`property_key_${index}`] && <span id={`prop-key-error-${index}`} style={{ color: 'red', marginLeft: '8px' }}>{formErrors[`property_key_${index}`]}</span>}
            {formErrors[`property_value_${index}`] && <span id={`prop-value-error-${index}`} style={{ color: 'red', marginLeft: '8px' }}>{formErrors[`property_value_${index}`]}</span>}
          </div>
        ))}
        <Button type="button" onClick={addPropertyField}>Add Property</Button>
      </div>

      <div>
        <Tooltip title="Check this to include an authenticity certificate with your inscription (details TBD).">
          <label htmlFor="includeAuthenticity">Include Authenticity Certificate</label>
        </Tooltip>
        <Switch
          id="includeAuthenticity"
          checked={includeAuthenticity}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIncludeAuthenticity(e.target.checked)}
        />
      </div>

      {userDids && userDids.length > 0 && (
        <div>
          <Tooltip title="Select one of your existing DIDs to associate with this inscription.">
            <label htmlFor="useDid">Use Existing DID</label>
          </Tooltip>
          <Select
            id="useDid"
            value={useDid || ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setUseDid(e.target.value || undefined);
              if (e.target.value) setCreateNewDid(false); // Uncheck create new if existing is selected
            }}
            disabled={createNewDid}
          >
            <option value="">Select DID</option>
            {userDids.map(did => <option key={did} value={did}>{did}</option>)}
          </Select>
        </div>
      )}

      <div>
        <Tooltip title="Check this to create and associate a new DID with this inscription (if no existing DID is selected).">
          <label htmlFor="createNewDid">Create New DID</label>
        </Tooltip>
        <Switch
          id="createNewDid"
          checked={createNewDid}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setCreateNewDid(e.target.checked);
            if (e.target.checked) setUseDid(undefined); // Clear selected DID if create new is checked
          }}
          disabled={!!useDid && userDids.length > 0}
        />
      </div>
      
      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Submitting...' : 'Submit Metadata'}
      </Button>
    </form>
  );
};

export default MetadataForm; 