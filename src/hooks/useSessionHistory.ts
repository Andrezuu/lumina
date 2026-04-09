/**
 * useSessionHistory.ts
 *
 * Fetches the user's session history and aggregated stats from the backend.
 * Exposes:
 *   sessions  — array of SessionWithBlocks, newest first
 *   stats     — SessionStats object (totals, accuracy, favourite tonality)
 *   loading   — true while the first fetch is in flight
 *   error     — error message string or null
 *   refresh   — call to re-fetch both endpoints
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getSessions,
  getSessionStats,
  type SessionStats,
  type SessionWithBlocks,
} from '../services/sessionService';

interface UseSessionHistoryResult {
  sessions:  SessionWithBlocks[];
  stats:     SessionStats | null;
  loading:   boolean;
  error:     string | null;
  refresh:   () => void;
}

export function useSessionHistory(): UseSessionHistoryResult {
  const [sessions, setSessions] = useState<SessionWithBlocks[]>([]);
  const [stats,    setStats]    = useState<SessionStats | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, st] = await Promise.all([getSessions(), getSessionStats()]);
      setSessions(s);
      setStats(st);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al cargar el historial';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { sessions, stats, loading, error, refresh: fetch };
}
