import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

/** Poll orders every 8s (replaces SSE on mobile/web app) */
export function useOrderPolling(onRefresh, enabled = true, intervalMs = 8000) {
  const { isAuthenticated } = useAuth();
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;

  useEffect(() => {
    if (!enabled || !isAuthenticated) return undefined;
    const id = setInterval(() => {
      cbRef.current?.();
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, isAuthenticated, intervalMs]);
}
