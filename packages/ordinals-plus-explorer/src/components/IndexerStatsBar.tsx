import React from 'react';
import { env } from '../config/envConfig';

type Stats = {
  totalOrdinalsPlus: number;
  totalProcessed: number;
  ordinalsFound: number;
  errors: number;
  lastUpdated: string | null;
  indexerVersion: string;
  cursor?: number | null;
  blockHeight?: number | null;
};

const IndexerStatsBar: React.FC = () => {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchStats = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${env.VITE_BACKEND_URL}/api/indexer/stats`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json?.error || `Failed to load stats (${res.status})`);
      }
      setStats(json.data as Stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 30000);
    return () => clearInterval(id);
  }, [fetchStats]);

  if (error) {
    return (
      <div className="bg-yellow-50 text-yellow-800 border border-yellow-200 px-3 py-2 text-xs rounded">
        Indexer stats unavailable: {error}
      </div>
    );
  }

  const nf = React.useMemo(() => new Intl.NumberFormat(undefined), []);

  return (
    <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-3">
      {loading && <span className="opacity-70">Loading indexer…</span>}
      {stats && (
        <>
          <span>
            <strong>Block</strong>: {stats.blockHeight != null ? nf.format(stats.blockHeight) : '—'}
          </span>
          <span className="hidden sm:inline">|</span>
          <span>
            <strong>Ordinals+</strong>: {nf.format(stats.totalOrdinalsPlus)}
          </span>
          <span className="hidden sm:inline">|</span>
          <span>
            <strong>Inscriptions</strong>: {stats.totalProcessed != null ? nf.format(stats.totalProcessed) : '—'}
          </span>
          <span className="hidden sm:inline">|</span>
          <span>
            <strong>Errors</strong>: {nf.format(stats.errors)}
          </span>
          <span className="hidden sm:inline">|</span>
          <span>
            <strong>Updated</strong>: {stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleTimeString() : '—'}
          </span>
        </>
      )}
    </div>
  );
};

export default IndexerStatsBar;


