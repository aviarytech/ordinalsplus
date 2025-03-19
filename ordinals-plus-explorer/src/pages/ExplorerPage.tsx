import DidExplorer from '../components/DidExplorer';

const ExplorerPage = () => {
  return (
    <div className="max-w-7xl mx-auto p-5">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Ordinals Plus Explorer</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Explore DIDs and linked resources on the Bitcoin Ordinals network
        </p>
      </header>
      
      <main>
        <DidExplorer />
      </main>
    </div>
  );
};

export default ExplorerPage;
