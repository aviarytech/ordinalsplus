# Ordinals Plus Explorer

A web application for exploring Bitcoin Ordinals DIDs (Decentralized Identifiers) and linked resources, allowing users to browse and filter inscriptions on the Bitcoin blockchain.

## Features

- 🔍 **DID Resolution**: Search and resolve Bitcoin Ordinals DIDs
- 📄 **DID Document Viewer**: Display DID Documents in a user-friendly format
- 🔗 **Linked Resources**: View resources associated with DIDs
- 🖼️ **Resource Viewer**: Preview various resource types (JSON, images, HTML, etc.)
- 🌗 **Dark Mode Support**: Fully responsive design with dark mode

## Tech Stack

- React with TypeScript
- Tailwind CSS for styling
- OrdinalsPlus library for DID and resource interaction
- Lucide icons

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/your-username/ordinals-plus-explorer.git
cd ordinals-plus-explorer
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Start the development server
```bash
npm start
# or
yarn start
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
ordinals-plus-explorer/
├── src/
│   ├── components/            # React components
│   │   ├── DidExplorer.tsx    # Main explorer component
│   │   ├── DidDocumentViewer.tsx # DID document display
│   │   ├── LinkedResourceList.tsx # Resource list component
│   │   └── ResourceCard.tsx   # Resource display component
│   ├── services/              # Service layer
│   │   └── did-service.ts     # DID and resource service
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
