"use client";

import { useCallback, useMemo, useState } from "react";
import { filterRowsByFeedQuery } from "@/lib/layout/list-workspace/feed-filter";
import {
  persistListFeedFilterQuery,
  readListFeedFilterQuery,
} from "@/lib/layout/list-workspace/feed-filter-storage";
import { useOptionalListWorkspace } from "@/lib/layout/list-workspace/list-workspace-context";

type Options<T> = {
  rows: readonly T[];
  extractSearchable: (row: T) => Iterable<string | null | undefined>;
  /** When omitted, uses the enclosing ListWorkspaceProvider module id. */
  storageModuleId?: string;
};

/** Client-side header feed filter (Items/Categories `feedFilter` parity). */
export function useListWorkspaceFeedFilter<T>({
  rows,
  extractSearchable,
  storageModuleId,
}: Options<T>) {
  const listWorkspace = useOptionalListWorkspace();
  const resolvedStorageModuleId = storageModuleId ?? listWorkspace?.moduleId;

  const [feedFilterQuery, setFeedFilterQueryState] = useState(() =>
    resolvedStorageModuleId ? readListFeedFilterQuery(resolvedStorageModuleId) : ""
  );

  const setFeedFilterQuery = useCallback(
    (value: string | ((previous: string) => string)) => {
      setFeedFilterQueryState((previous) => {
        const next = typeof value === "function" ? value(previous) : value;
        if (resolvedStorageModuleId) {
          persistListFeedFilterQuery(resolvedStorageModuleId, next);
        }
        return next;
      });
    },
    [resolvedStorageModuleId]
  );

  const feedFilteredRows = useMemo(
    () => filterRowsByFeedQuery(rows, feedFilterQuery, extractSearchable),
    [extractSearchable, feedFilterQuery, rows]
  );

  const feedFilterProps = useMemo(
    () => ({
      value: feedFilterQuery,
      onChange: setFeedFilterQuery,
    }),
    [feedFilterQuery, setFeedFilterQuery]
  );

  const clearFeedFilter = useCallback(() => setFeedFilterQuery(""), [setFeedFilterQuery]);

  return {
    feedFilterQuery,
    setFeedFilterQuery,
    feedFilteredRows,
    feedFilterProps,
    clearFeedFilter,
  };
}
