import React, { useState } from 'react';

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
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="title">Title (Required)</label>
        <TextField
          id="title"
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(setTitle, 'title', e.target.value)}
          maxLength={MAX_TITLE_LENGTH} // Enforce character limit
          aria-invalid={!!formErrors.title}
          aria-describedby={formErrors.title ? "title-error" : undefined}
        />
        {formErrors.title && <span id="title-error" style={{ color: 'red' }}>{formErrors.title}</span>}
      </div>

      <div>
        <label htmlFor="description">Description (Required)</label>
        <TextField // Should ideally be a textarea for multiline
          id="description"
          value={description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(setDescription, 'description', e.target.value)}
          maxLength={MAX_DESCRIPTION_LENGTH} // Enforce character limit
          aria-invalid={!!formErrors.description}
          aria-describedby={formErrors.description ? "description-error" : undefined}
          // multiline={true}
        />
        {formErrors.description && <span id="description-error" style={{ color: 'red' }}>{formErrors.description}</span>}
      </div>

      <div>
        <label htmlFor="creationDate">Creation Date</label>
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
        <label htmlFor="creator">Creator/Artist Name or DID</label>
        <TextField
          id="creator"
          value={creator}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(setCreator, 'creator', e.target.value)}
          // No specific validation yet for creator beyond being optional
        />
      </div>
      
      <div>
        <label htmlFor="contentType">Content Type</label>
        <TextField
          id="contentType"
          value={contentType}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(setContentType, 'contentType', e.target.value)}
           // No specific validation yet for contentType beyond being optional
        />
      </div>

      <div>
        <label>Custom Properties</label>
        {properties.map((prop, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <TextField
              placeholder="Property Key"
              value={prop.key}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePropertyFieldChange(index, 'key', e.target.value)}
              aria-invalid={!!formErrors[`property_key_${index}`]}
              aria-describedby={formErrors[`property_key_${index}`] ? `prop-key-error-${index}` : undefined}
            />
            {formErrors[`property_key_${index}`] && <span id={`prop-key-error-${index}`} style={{ color: 'red', marginLeft: '8px' }}>{formErrors[`property_key_${index}`]}</span>}
            <TextField
              style={{ marginLeft: '8px' }}
              placeholder="Property Value"
              value={prop.value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePropertyFieldChange(index, 'value', e.target.value)}
              aria-invalid={!!formErrors[`property_value_${index}`]}
              aria-describedby={formErrors[`property_value_${index}`] ? `prop-value-error-${index}` : undefined}
            />
            {formErrors[`property_value_${index}`] && <span id={`prop-value-error-${index}`} style={{ color: 'red', marginLeft: '8px' }}>{formErrors[`property_value_${index}`]}</span>}
            {properties.length > 1 && (
              <Button type="button" onClick={() => removePropertyField(index)} style={{ marginLeft: '8px' }}>
                Remove
              </Button>
            )}
          </div>
        ))}
         <Button type="button" onClick={addPropertyField}>
          Add Property
        </Button>
      </div>
      

      <div>
        <label htmlFor="includeAuthenticity">Include Authenticity Certificate</label>
        <Switch
          id="includeAuthenticity"
          checked={includeAuthenticity}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIncludeAuthenticity(e.target.checked)}
        />
      </div>

      {userDids && userDids.length > 0 && (
        <div>
          <label htmlFor="useDid">Use Existing DID</label>
          <Select
            id="useDid"
            value={useDid}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setUseDid(e.target.value || undefined);
              if (e.target.value) setCreateNewDid(false); // Uncheck create new if existing is selected
            }}
          >
            <option value="">Select DID</option>
            {userDids.map(did => (
              <option key={did} value={did}>{did}</option>
            ))}
          </Select>
        </div>
      )}

      <div>
        <label htmlFor="createNewDid">Create New DID</label>
        <Switch
          id="createNewDid"
          checked={createNewDid}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setCreateNewDid(e.target.checked);
            if (e.target.checked) setUseDid(undefined); // Unselect existing DID if create new is checked
          }}
          disabled={!!useDid} // Disable if an existing DID is selected
        />
      </div>
      
      {/* Tooltips and warning about data permanence will be added as per parent task details */}
      {/* Character limits will be part of validation in subtask 1.2 */}
      {/* Metadata preview will be a separate feature/enhancement */}

      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Submitting...' : 'Submit Metadata'}
      </Button>
    </form>
  );
};

export default MetadataForm; 