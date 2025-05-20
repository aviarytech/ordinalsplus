import React from 'react';

export interface ContentTypeSelectorProps {
  selectedType: string;
  onChange: (type: string) => void;
  className?: string;
}

/**
 * A component for selecting content type for resource inscriptions
 */
const ContentTypeSelector: React.FC<ContentTypeSelectorProps> = ({
  selectedType,
  onChange,
  className = '',
}) => {
  // Define supported content types
  const contentTypes = [
    { value: 'text/plain', label: 'Plain Text' },
    { value: 'application/json', label: 'JSON' },
    { value: 'image/png', label: 'PNG Image' },
    { value: 'image/jpeg', label: 'JPEG Image' },
    { value: 'image/svg+xml', label: 'SVG Image' },
  ];

  return (
    <div className={`content-type-selector ${className}`}>
      <label htmlFor="content-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Content Type
      </label>
      <select
        id="content-type"
        value={selectedType}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      >
        {contentTypes.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label} ({type.value})
          </option>
        ))}
      </select>
    </div>
  );
};

export default ContentTypeSelector;
