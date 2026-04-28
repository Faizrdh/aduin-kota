/*eslint-disable*/

// src/hooks/useAILabel.ts


import { useState, useEffect, useRef, useCallback } from "react";
import { authFetch } from "@/data/login";

interface AILabelState {
  label:      string | null;
  score:      number | null;
  overridden: boolean;
  loading:    boolean;
}

interface UseAILabelOptions {
  initialLabel?:  string | null;
  initialScore?:  number | null;
  /** Interval polling dalam ms (default: 3000) */
  pollInterval?:  number;
  /** Berapa kali polling sebelum menyerah (default: 10 → 30 detik) */
  maxAttempts?:   number;
  /** Aktifkan polling atau tidak (default: true) */
  enabled?:       boolean;
}

export function useAILabel(
  reportId: string | null | undefined,
  options: UseAILabelOptions = {}
): AILabelState & { refetch: () => void } {
  const {
    initialLabel  = null,
    initialScore  = null,
    pollInterval  = 3_000,
    maxAttempts   = 10,
    enabled       = true,
  } = options;

  const [state, setState] = useState<AILabelState>({
    label:      initialLabel,
    score:      initialScore,
    overridden: false,
    loading:    !initialLabel && enabled, // loading jika belum ada label
  });

  const attemptsRef = useRef(0);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLabel = useCallback(async () => {
    if (!reportId || !enabled) return;

    try {
      const res = await authFetch(`/api/reports/${reportId}`);
      if (!res.ok) return;

      const json = await res.json();
      const report = json?.data;

      if (!report) return;

      const newLabel = report.ai_label ?? null;

      setState({
        label:      newLabel,
        score:      report.confidence_score ?? null,
        overridden: report.ai_overridden ?? false,
        loading:    false,
      });

      // Jika label sudah terisi atau sudah max attempts → stop polling
      if (newLabel || attemptsRef.current >= maxAttempts) {
        if (timerRef.current) clearTimeout(timerRef.current);
        return;
      }

    } catch {
      // Gagal fetch → lanjut polling, jangan stop
    }
  }, [reportId, enabled, maxAttempts]);

  const scheduleNext = useCallback(() => {
    attemptsRef.current += 1;
    if (attemptsRef.current >= maxAttempts) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }
    timerRef.current = setTimeout(async () => {
      await fetchLabel();
      // Cek lagi apakah perlu lanjut polling
      setState((prev) => {
        if (!prev.label && attemptsRef.current < maxAttempts) {
          scheduleNext();
        }
        return prev;
      });
    }, pollInterval);
  }, [fetchLabel, maxAttempts, pollInterval]);

  useEffect(() => {
    // Jika label sudah ada dari awal (dari SSR/server), tidak perlu polling
    if (initialLabel || !reportId || !enabled) {
      setState({
        label:      initialLabel,
        score:      initialScore,
        overridden: false,
        loading:    false,
      });
      return;
    }

    // Fetch langsung saat mount, lalu schedule polling
    attemptsRef.current = 0;
    fetchLabel().then(() => {
      setState((prev) => {
        if (!prev.label) scheduleNext();
        return prev;
      });
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reportId, enabled]);  // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(() => {
    attemptsRef.current = 0;
    setState((prev) => ({ ...prev, loading: true }));
    fetchLabel();
  }, [fetchLabel]);

  return { ...state, refetch };
}