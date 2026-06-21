"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { DocumentListPage } from "@/lib/documents/list-page";

export function useDocumentListPagination<TRow>(
  initialRows: TRow[],
  initialTotalCount: number,
  initialHasMore: boolean,
  fetchPage: (offset: number) => Promise<DocumentListPage<TRow>>,
  noun = "records"
) {
  const [rows, setRows] = useState(initialRows);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, startLoadMore] = useTransition();
  const [isRefreshing, startRefresh] = useTransition();
  const bootstrapRequestedRef = useRef(initialRows.length > 0);

  const applyPage = useCallback((page: DocumentListPage<TRow>) => {
    setRows(page.rows);
    setTotalCount(page.totalCount);
    setHasMore(page.hasMore);
  }, []);

  // Reconcile SSR props when the client mounted before streamed data arrived.
  useEffect(() => {
    if (initialRows.length === 0) return;
    bootstrapRequestedRef.current = true;
    setRows((current) => (current.length === 0 ? initialRows : current));
    setTotalCount((current) =>
      current === 0 && initialTotalCount > 0 ? initialTotalCount : current
    );
    setHasMore((current) => (current === false && initialHasMore ? initialHasMore : current));
  }, [initialRows, initialHasMore, initialTotalCount]);

  const refreshList = useCallback(() => {
    startRefresh(async () => {
      try {
        const page = await fetchPage(0);
        applyPage(page);
      } catch (error) {
        console.error("[useDocumentListPagination] refresh failed", error);
        toast.error(error instanceof Error ? error.message : `Unable to refresh ${noun}.`);
      }
    });
  }, [applyPage, fetchPage, noun]);

  // Client bootstrap when SSR delivered no rows (dynamic boundary / streaming edge case).
  useEffect(() => {
    if (initialRows.length > 0 || bootstrapRequestedRef.current) return;
    bootstrapRequestedRef.current = true;
    startRefresh(async () => {
      try {
        const page = await fetchPage(0);
        applyPage(page);
      } catch (error) {
        console.error("[useDocumentListPagination] bootstrap failed", error);
        toast.error(error instanceof Error ? error.message : `Unable to load ${noun}.`);
      }
    });
  }, [applyPage, fetchPage, initialRows.length, noun]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    startLoadMore(async () => {
      try {
        const page = await fetchPage(rows.length);
        setRows((current) => [...current, ...page.rows]);
        setTotalCount(page.totalCount);
        setHasMore(page.hasMore);
      } catch (error) {
        console.error("[useDocumentListPagination] load more failed", error);
        toast.error(error instanceof Error ? error.message : `Unable to load more ${noun}.`);
      }
    });
  }, [fetchPage, hasMore, isLoadingMore, noun, rows.length]);

  const isListBootstrapping = isRefreshing && rows.length === 0;

  return {
    rows,
    setRows,
    totalCount,
    hasMore,
    isLoadingMore,
    isRefreshing,
    isListBootstrapping,
    refreshList,
    loadMore,
  };
}
