import React, { useState } from 'react';
import VCApiProviderSettings from '../components/settings/VCApiProviderSettings';
import PageLayout from '../components/layout/PageLayout';
import './Settings.css';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('vc-api');

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  return (
    <PageLayout>
      <div className="settings-page">
        <h2 className="settings-page-title">Settings</h2>
        
        <div className="settings-tabs">
          <div className="settings-tabs-header">
            <button 
              className={`settings-tab-button ${activeTab === 'vc-api' ? 'active' : ''}`}
              onClick={() => handleTabChange('vc-api')}
            >
              VC API Providers
            </button>
            {/* Add more tab buttons here as needed */}
          </div>
          
          <div className="settings-tabs-content">
            {activeTab === 'vc-api' && <VCApiProviderSettings />}
            {/* Add more tab content here as needed */}
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Settings;
