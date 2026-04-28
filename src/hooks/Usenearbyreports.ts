/*eslint-disable*/
/**
 * useNearbyReports — Reactive nearby-report detection hook
 *
 * Provides:
 *  - Debounced auto-fetch whenever lat/lng/category change
 *  - Manual `refetch()` for on-demand freshness checks (e.g. right before submit)
 *  - `joinReport()` API helper
 *  - `getNearbyReports()` standalone async helper (usable outside React)
 *
 * Usage:
 *   const { reports, loading, refetch } = useNearbyReports({
 *     lat: pos?.lat ?? null,
 *     lng: pos?.lng ?? null,
 *     category,
 *     enabled: step >= 1,
 *   });
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { authFetch } from "@/data/login";
import type { Category } from "@/data/reports";

// ─── Shared Type ──────────────────────────────────────────────────────────────
// Exported so CivicMap, submit.tsx, and any future consumer share one definition.

export interface NearbyReport {
  id:             string;
  title:          string;
  description:    string;
  category:       string;
  status:         string;
  distanceMeters: number;
  imageUrl:       string | null;
  createdAt:      string;
  /** Coordinates returned by the backend — needed for map rendering */
  lat:            number;
  lng:            number;
  user:           { id: string; name: string; avatar: string | null };
  _count:         { joins: number };
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

const API_BASE = "/api/reports";

/**
 * Fetch reports within `radius` metres of the given point.
 * Safe to call outside React (e.g. in a plain async function).
 */
export async function getNearbyReports(
  lat:      number,
  lng:      number,
  category: string,
  radius    = 100,
): Promise<NearbyReport[]> {
  const cat = category.toUpperCase();
  const url = `${API_BASE}/nearby?lat=${lat}&lng=${lng}&radius=${radius}&category=${cat}`;
  const res = await authFetch(url);
  if (!res.ok) throw new Error(`Nearby fetch failed: HTTP ${res.status}`);
  const json = await res.json();
  return (json.data ?? []) as NearbyReport[];
}

/**
 * Join an existing report (POST /:id/join).
 * Throws a localised Error on failure so the caller can surface it.
 */
export async function joinReport(reportId: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/${reportId}/join`, {
    method: "POST",
    body:   JSON.stringify({}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Gagal bergabung: HTTP ${res.status}`);
  }
}

// ─── Hook Options / Return ────────────────────────────────────────────────────

export interface UseNearbyReportsOptions {
  lat:         number | null;
  lng:         number | null;
  category:    Category | null;
  /** Search radius in metres (default: 100) */
  radius?:     number;
  /** Only run the query when true — lets consumers gate by step (default: true) */
  enabled?:    boolean;
  /** Debounce delay in ms — prevents a flood of requests while dragging (default: 700) */
  debounceMs?: number;
}

export interface UseNearbyReportsResult {
  reports:  NearbyReport[];
  loading:  boolean;
  error:    string | null;
  /** Force an immediate (non-debounced) re-fetch */
  refetch:  () => Promise<void>;
  /** Clear results and reset error state without re-fetching */
  clear:    () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNearbyReports({
  lat,
  lng,
  category,
  radius     = 100,
  enabled    = true,
  debounceMs = 700,
}: UseNearbyReportsOptions): UseNearbyReportsResult {
  const [reports, setReports] = useState<NearbyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Track whether the component is still mounted to avoid setting state after unmount.
  const mountedRef  = useRef(true);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Core fetch logic — extracted so both the debounce path and `refetch()` share it.
  const doFetch = useCallback(async (): Promise<void> => {
    if (!lat || !lng || !category || !mountedRef.current) return;

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const data = await getNearbyReports(lat, lng, category, radius);
      if (mountedRef.current) setReports(data);
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err?.message ?? "Gagal memuat laporan terdekat.");
        setReports([]);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [lat, lng, category, radius]);

  // Reactive path — debounced whenever inputs change.
  useEffect(() => {
    if (!enabled || !lat || !lng || !category) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setReports([]);
      setLoading(false);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doFetch, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, lat, lng, category, radius, debounceMs, doFetch]);

  // Non-debounced manual trigger (e.g. right before submit).
  const refetch = useCallback(async (): Promise<void> => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await doFetch();
  }, [doFetch]);

  const clear = useCallback((): void => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setReports([]);
    setError(null);
    setLoading(false);
  }, []);

  return { reports, loading, error, refetch, clear };
}