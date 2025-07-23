# Ordinals Plus Explorer

A comprehensive web application for exploring Bitcoin Ordinals DIDs (Decentralized Identifiers) and linked resources, allowing users to browse and filter inscriptions on the Bitcoin blockchain.

## Features

- Browse and filter Bitcoin Ordinals DIDs and linked resources
- View detailed information about inscriptions and resources
- Switch between mainnet (Ordiscan API) and local development (Ord Node) via backend proxy
- Dark mode support
- Responsive design

## Tech Stack

- React with TypeScript
- Tailwind CSS for styling
- OrdinalsPlus library for DID and resource interaction
- Lucide icons

## Architecture

The application follows a secure architecture where all network requests are handled through the backend:

```
┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│                   │      │                   │      │                   │
│  Frontend (React) │─────▶│  Backend (Elysia) │─────▶│  Ordiscan API     │
│                   │      │                   │      │                   │
└───────────────────┘      └────────┬──────────┘      └───────────────────┘
                                    │
                                    │
                                    ▼
                           ┌───────────────────┐
                           │                   │
                           │  Local Ord Node   │
                           │                   │
                           └───────────────────┘
```

The backend API server proxies all requests to either the Ordiscan API or the local Ord node based on the network selection. This ensures:

1. API keys are never exposed to the client
2. All network traffic is routed through the backend
3. Data transformation is consistent regardless of data source
4. **The frontend never connects directly to either the Ord node or Ordiscan**

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Local Ord node (for development and testing)
- Backend API server running (required for all operations)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ordinals-plus-explorer.git
   cd ordinals-plus-explorer
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env` file based on the `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your configuration:
   ```
   VITE_BACKEND_URL=http://localhost:3000
   ```

5. Setup the backend API server:
   ```bash
   cd ../ordinals-plus-api
   cp .env.example .env
   # Edit .env to include your Ordiscan API key
   ```


## Network Configuration

The application supports two network modes, both accessed through the backend:

1. **Local Ord Node**: Uses a local instance of the Ord node for development and testing
2. **Ordiscan Mainnet**: Uses the Ordiscan API for production use on the Bitcoin mainnet

### Setting Up Local Ord Node

To run a local Ord node, follow these steps:

1. Install Ord (see [Ord installation guide](https://github.com/ordinals/ord))
3. Update the backend `.env` file with the correct Ord node URL:
   ```
   ORD_NODE_URL=http://localhost:9001
   ```

### Backend API Configuration

The backend API serves as a proxy for both network types:

1. Configure the Ordiscan API key in the backend `.env` file:
   ```
   ORDISCAN_API_KEY=your_ordiscan_api_key_here
   ```

2. Configure the Ord node URL in the backend `.env` file:
   ```
   ORD_NODE_URL=http://localhost:9001
   ```

## Using the Network Selector

The application provides a network selector in the UI that allows you to switch between:

- **Local**: Uses your local Ord node via the backend proxy
- **Mainnet**: Uses the Ordiscan API via the backend proxy

When the application starts, it will use the default network specified in your `.env` file. The network selection is persisted in localStorage, so it will remember your choice between sessions.

## Project Structure

```
ordinals-plus-explorer/
├── src/
│   ├── components/            # React components
│   │   ├── DidExplorer.tsx    # Main explorer component
│   │   ├── DidDocumentViewer.tsx # DID document display
│   │   ├── LinkedResourceList.tsx # Resource list component
│   │   └── ResourceCard.tsx   # Resource display component
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Utility functions
│       └── formatting.ts      # Formatting utilities
├── public/                    # Static assets
└── package.json               # Project dependencies
```

## Acknowledgements

- [Bitcoin Ordinals DID Method Specification](https://identity.foundation/labs-ordinals-plus/btco-did-method)
- [Bitcoin Ordinals DID Linked Resources Specification](https://identity.foundation/labs-ordinals-plus/btco-did-linked-resources)
- [Ordinals Plus Library](https://github.com/yourname/ordinalsplus)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
