import React, { useState } from 'react';

interface JSONFormatterProps {
  json: unknown;
  expanded?: boolean;
}

const JSONFormatter: React.FC<JSONFormatterProps> = ({ json, expanded = false }) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  
  // Function to toggle the expanded state of a specific path
  const togglePath = (path: string) => {
    const newExpandedPaths = new Set(expandedPaths);
    if (newExpandedPaths.has(path)) {
      newExpandedPaths.delete(path);
    } else {
      newExpandedPaths.add(path);
    }
    setExpandedPaths(newExpandedPaths);
  };
  
  // Function to format primitive values
  const formatValue = (value: unknown): React.ReactNode => {
    if (value === null) return <span className="text-gray-500 dark:text-gray-400">null</span>;
    if (value === undefined) return <span className="text-gray-500 dark:text-gray-400">undefined</span>;
    
    switch (typeof value) {
      case 'boolean':
        return <span className="text-purple-600 dark:text-purple-400">{value.toString()}</span>;
      case 'number':
        return <span className="text-blue-600 dark:text-blue-400">{value}</span>;
      case 'string':
        return <span className="text-green-600 dark:text-green-400">"{value}"</span>;
      default:
        return <span>{JSON.stringify(value)}</span>;
    }
  };
  
  // Recursive function to render a JSON object or array
  const renderJSON = (data: unknown, path: string = 'root', level: number = 0): JSX.Element => {
    if (data === null || typeof data !== 'object') {
      return <span>{formatValue(data)}</span>;
    }
    
    const isArray = Array.isArray(data);
    const isEmpty = Object.keys(data).length === 0;
    const isExpanded = expanded || expandedPaths.has(path);
    
    if (isEmpty) {
      return <span>{isArray ? '[]' : '{}'}</span>;
    }
    
    const indentation = '  '.repeat(level);
    const childIndentation = '  '.repeat(level + 1);
    
    return (
      <div>
        <span 
          className="cursor-pointer text-gray-600 dark:text-gray-300 select-none"
          onClick={() => togglePath(path)}
        >
          {isArray ? '[' : '{'}
          {!isExpanded && '...'}
          {!isExpanded && (isArray ? ']' : '}')}
        </span>
        
        {isExpanded && (
          <>
            <div className="pl-4 border-l border-gray-200 dark:border-gray-700 ml-1">
              {Object.entries(data).map(([key, value], index) => (
                <div key={`${path}-${key}`} className="font-mono leading-relaxed text-sm">
                  <span className="text-gray-400 dark:text-gray-500">{childIndentation}</span>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {isArray ? '' : `"${key}": `}
                  </span>
                  {renderJSON(value, `${path}-${key}`, level + 1)}
                  {index < Object.keys(data).length - 1 && <span className="text-gray-400 dark:text-gray-500">,</span>}
                </div>
              ))}
            </div>
            <span className="text-gray-600 dark:text-gray-300">
              {indentation}{isArray ? ']' : '}'}
            </span>
          </>
        )}
      </div>
    );
  };
  
  return (
    <div className="font-mono text-sm overflow-auto whitespace-pre text-gray-800 dark:text-gray-200 rounded-md">
      {renderJSON(json)}
    </div>
  );
};

export default JSONFormatter; 