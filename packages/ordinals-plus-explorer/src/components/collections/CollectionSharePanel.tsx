import React, { useState } from 'react';
import { Collection } from '../../services/collectionService';
import './CollectionSharePanel.css';

interface CollectionSharePanelProps {
  collection: Collection;
  className?: string;
}

/**
 * A component for sharing collection information via various methods
 */
const CollectionSharePanel: React.FC<CollectionSharePanelProps> = ({
  collection,
  className = ''
}) => {
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');
  
  // Get the current URL for sharing
  const shareUrl = window.location.href;
  
  // Toggle share panel visibility
  const toggleSharePanel = () => {
    setShowSharePanel(!showSharePanel);
    setCopySuccess('');
  };
  
  // Copy link to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setCopySuccess('Link copied!');
        setTimeout(() => setCopySuccess(''), 3000);
      })
      .catch(err => {
        console.error('Failed to copy link: ', err);
        setCopySuccess('Failed to copy');
      });
  };
  
  // Share on Twitter
  const shareOnTwitter = () => {
    const text = `Check out this collection: ${collection.metadata.name} on OrdinalsPlus`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  };
  
  // Share on Facebook
  const shareOnFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  };
  
  // Generate embed code
  const getEmbedCode = () => {
    return `<iframe src="${shareUrl}/embed" width="100%" height="500" frameborder="0" allowfullscreen></iframe>`;
  };
  
  // Copy embed code to clipboard
  const copyEmbedCode = () => {
    navigator.clipboard.writeText(getEmbedCode())
      .then(() => {
        setCopySuccess('Embed code copied!');
        setTimeout(() => setCopySuccess(''), 3000);
      })
      .catch(err => {
        console.error('Failed to copy embed code: ', err);
        setCopySuccess('Failed to copy');
      });
  };
  
  return (
    <div className={`collection-share-container ${className}`}>
      <button 
        className="share-toggle-button"
        onClick={toggleSharePanel}
        aria-expanded={showSharePanel}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="share-icon">
          <path fillRule="evenodd" d="M15.75 4.5a3 3 0 11.825 2.066l-8.421 4.679a3.002 3.002 0 010 1.51l8.421 4.679a3 3 0 11-.729 1.31l-8.421-4.678a3 3 0 110-4.132l8.421-4.679a3 3 0 01-.096-.755z" clipRule="evenodd" />
        </svg>
        Share Collection
      </button>
      
      {showSharePanel && (
        <div className="share-panel">
          <div className="share-panel-header">
            <h3>Share "{collection.metadata.name}"</h3>
            <button 
              className="close-button"
              onClick={toggleSharePanel}
              aria-label="Close share panel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="close-icon">
                <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div className="share-options">
            <div className="share-option">
              <div className="share-link-container">
                <input 
                  type="text" 
                  value={shareUrl} 
                  readOnly 
                  className="share-link-input"
                />
                <button 
                  onClick={copyToClipboard}
                  className="copy-button"
                >
                  Copy Link
                </button>
              </div>
            </div>
            
            <div className="share-social">
              <button 
                onClick={shareOnTwitter}
                className="social-button twitter"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="social-icon">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
                Twitter
              </button>
              
              <button 
                onClick={shareOnFacebook}
                className="social-button facebook"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="social-icon">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
                Facebook
              </button>
            </div>
            
            <div className="share-embed">
              <h4>Embed Collection</h4>
              <div className="embed-code-container">
                <textarea 
                  readOnly 
                  value={getEmbedCode()}
                  className="embed-code"
                />
                <button 
                  onClick={copyEmbedCode}
                  className="copy-button"
                >
                  Copy Code
                </button>
              </div>
            </div>
            
            {copySuccess && (
              <div className="copy-success-message">
                {copySuccess}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionSharePanel;
