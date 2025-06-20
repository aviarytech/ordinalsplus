import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Assuming Tailwind CSS setup is here
import { ApiProvider } from './context/ApiContext';
import { NetworkProvider } from './context/NetworkContext';
import { WalletProvider } from './context/WalletContext'; // Our direct wallet provider
import { env } from './config/envConfig';

// Add debug logging for initialization
console.log('Initializing application with direct wallet support', env);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* ApiProvider must wrap NetworkProvider */}
    <ApiProvider>
      <NetworkProvider>
        <WalletProvider>
          <App />
        </WalletProvider>
      </NetworkProvider>
    </ApiProvider>
  </React.StrictMode>
);
