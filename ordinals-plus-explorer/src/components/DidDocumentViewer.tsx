import React, { useState } from 'react';
import { Copy, CheckCircle2 } from 'lucide-react';
import { DidDocument, VerificationMethod, Service } from 'ordinalsplus';

interface DidDocumentViewerProps {
  document: DidDocument;
}

const DidDocumentViewer: React.FC<DidDocumentViewerProps> = ({ document }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'raw'>('summary');
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(document, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'summary'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'raw'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('raw')}
        >
          Raw JSON
        </button>
        
        {/* Copy Button */}
        <button
          className="ml-auto px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center space-x-1"
          onClick={copyToClipboard}
        >
          {copied ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {activeTab === 'summary' ? (
          <div className="space-y-4">
            {/* ID */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">ID</h3>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-mono break-all">
                {document.id}
              </p>
            </div>
            
            {/* Controller (if present) */}
            {document.controller && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Controller</h3>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-mono break-all">
                  {Array.isArray(document.controller) 
                    ? document.controller.join(', ') 
                    : document.controller}
                </p>
              </div>
            )}
            
            {/* Context */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Context</h3>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-mono break-all">
                {Array.isArray(document['@context']) 
                  ? document['@context'].join(', ') 
                  : document['@context']}
              </p>
            </div>
            
            {/* Verification Methods */}
            {document.verificationMethod && document.verificationMethod.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Verification Methods</h3>
                <div className="mt-1 space-y-2">
                  {document.verificationMethod.map((method: VerificationMethod, index: number) => (
                    <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <div className="grid grid-cols-1 gap-1">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">ID</span>
                          <span className="text-sm text-gray-900 dark:text-gray-100 font-mono break-all">{method.id}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Type</span>
                          <span className="text-sm text-gray-900 dark:text-gray-100">{method.type}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Controller</span>
                          <span className="text-sm text-gray-900 dark:text-gray-100 font-mono break-all">{method.controller}</span>
                        </div>
                        {method.publicKeyMultibase && (
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Public Key (Multibase)</span>
                            <span className="text-sm text-gray-900 dark:text-gray-100 font-mono break-all">{method.publicKeyMultibase}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Services */}
            {document.service && document.service.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Services</h3>
                <div className="mt-1 space-y-2">
                  {document.service.map((service: Service, index: number) => (
                    <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <div className="grid grid-cols-1 gap-1">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">ID</span>
                          <span className="text-sm text-gray-900 dark:text-gray-100 font-mono break-all">{service.id}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Type</span>
                          <span className="text-sm text-gray-900 dark:text-gray-100">{service.type}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Service Endpoint</span>
                          <span className="text-sm text-gray-900 dark:text-gray-100 font-mono break-all">
                            {typeof service.serviceEndpoint === 'string' 
                              ? service.serviceEndpoint 
                              : Array.isArray(service.serviceEndpoint)
                                ? service.serviceEndpoint.join(', ')
                                : JSON.stringify(service.serviceEndpoint)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Deactivated */}
            {document.deactivated !== undefined && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</h3>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {document.deactivated 
                    ? <span className="text-red-500 font-medium">Deactivated</span> 
                    : <span className="text-green-500 font-medium">Active</span>}
                </p>
              </div>
            )}
          </div>
        ) : (
          <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md overflow-auto max-h-[30rem] text-sm font-mono text-gray-800 dark:text-gray-200">
            {JSON.stringify(document, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};

export default DidDocumentViewer; 