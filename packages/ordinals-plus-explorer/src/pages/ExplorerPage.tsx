import DidExplorer from '../components/DidExplorer';

const ExplorerPage = () => {
  return (
    <div className="max-w-7xl mx-auto p-5">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">
          BTCO DID Resolver
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
          Resolve Bitcoin Ordinals-based Decentralized Identifiers according to the BTCO DID Method Specification
        </p>
        <p className="text-lg text-gray-500 dark:text-gray-400">
          Enter any BTCO DID to retrieve its DID document, verification methods, and linked resources from the Bitcoin blockchain
        </p>
      </header>
      
      <main>
        <DidExplorer />
      </main>
    </div>
  );
};

export default ExplorerPage;
