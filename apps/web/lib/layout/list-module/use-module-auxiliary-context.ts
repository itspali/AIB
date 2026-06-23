"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

const DEFAULT_STALE_MS = 60_000;

type Options<T> = {
  enabled?: boolean;
  staleTime?: number;
  onError?: () => void;
};

/**
 * SSR-seeded module context (catalog settings, lookup tables) cached across
 * drawer opens and route transitions within the same session.
 */
export function useModuleAuxiliaryContext<T>(
  queryKey: readonly unknown[],
  fetchFn: () => Promise<T>,
  initialData: T | null | undefined,
  options: Options<T> = {}
) {
  const queryClient = useQueryClient();
  const enabled = options.enabled ?? true;
  const staleTime = options.staleTime ?? DEFAULT_STALE_MS;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await fetchFn();
      } catch {
        options.onError?.();
        throw new Error("auxiliary-context-fetch-failed");
      }
    },
    enabled,
    initialData: initialData ?? undefined,
    staleTime,
  });

  const ensureLoaded = useCallback(async (): Promise<T | null> => {
    if (!enabled) return null;
    if (query.data != null) return query.data;
    try {
      return await queryClient.fetchQuery({
        queryKey,
        queryFn: fetchFn,
        staleTime,
      });
    } catch {
      options.onError?.();
      return null;
    }
  }, [enabled, fetchFn, query.data, queryClient, queryKey, staleTime, options.onError]);

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    ensureLoaded,
  };
}
