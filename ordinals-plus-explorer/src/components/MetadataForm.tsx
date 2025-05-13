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
  const [properties, setProperties] = useState<Record<string, any>>({});
  const [includeAuthenticity, setIncludeAuthenticity] = useState(false);
  const [useDid, setUseDid] = useState<string | undefined>(undefined);
  const [createNewDid, setCreateNewDid] = useState(false);

  // Basic handler for custom properties (simplified for now)
  const handlePropertyChange = (key: string, value: any) => {
    setProperties(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      title,
      description,
      creationDate: creationDate || undefined,
      creator: creator || undefined,
      contentType: contentType || undefined,
      properties: Object.keys(properties).length > 0 ? properties : undefined,
      includeAuthenticity,
      useDid: useDid || undefined,
      createNewDid: createNewDid && !useDid ? createNewDid : undefined, // Only true if no existing DID is selected
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="title">Title (Required)</label>
        <TextField
          id="title"
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          // required - validation will be in subtask 1.2
        />
      </div>

      <div>
        <label htmlFor="description">Description (Required)</label>
        <TextField
          id="description"
          value={description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
          // multiline={true} // Assuming TextField supports this or use a textarea
          // required
        />
      </div>

      <div>
        <label htmlFor="creationDate">Creation Date</label>
        <TextField
          id="creationDate"
          type="date" // Or use a date picker component if available
          value={creationDate}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreationDate(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="creator">Creator/Artist Name or DID</label>
        <TextField
          id="creator"
          value={creator}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreator(e.target.value)}
        />
      </div>
      
      <div>
        <label htmlFor="contentType">Content Type</label>
        <TextField
          id="contentType"
          value={contentType}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContentType(e.target.value)}
        />
      </div>

      <div>
        <label>Custom Properties</label>
        {/* Simplified property input for now; will need dynamic add/remove logic */}
        <div>
          <TextField
            placeholder="Property Key"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePropertyChange(e.target.value, properties[e.target.value] || '')}
          />
          <TextField
            placeholder="Property Value"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const keys = Object.keys(properties);
                // This is a very basic way to handle a single dynamic property for now
                // A more robust solution is needed for multiple dynamic properties
                if (keys.length > 0) {
                  handlePropertyChange(keys[0], e.target.value)
                } else {
                    // Handle case where no key is set yet or add a default key
                }
            }}
          />
        </div>
         <Button type="button" onClick={() => alert("Add property logic to be implemented")}>
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