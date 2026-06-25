"use client";

import { useCallback, useMemo, useState } from "react";
import { filterRowsByFeedQuery } from "@/lib/layout/list-workspace/feed-filter";

type Options<T> = {
  rows: readonly T[];
  extractSearchable: (row: T) => Iterable<string | null | undefined>;
};

/** Client-side header feed filter (Items/Categories `feedFilter` parity). */
export function useListWorkspaceFeedFilter<T>({ rows, extractSearchable }: Options<T>) {
  const [feedFilterQuery, setFeedFilterQuery] = useState("");

  const feedFilteredRows = useMemo(
    () => filterRowsByFeedQuery(rows, feedFilterQuery, extractSearchable),
    [extractSearchable, feedFilterQuery, rows]
  );

  const feedFilterProps = useMemo(
    () => ({
      value: feedFilterQuery,
      onChange: setFeedFilterQuery,
    }),
    [feedFilterQuery]
  );

  const clearFeedFilter = useCallback(() => setFeedFilterQuery(""), []);

  return {
    feedFilterQuery,
    setFeedFilterQuery,
    feedFilteredRows,
    feedFilterProps,
    clearFeedFilter,
  };
}
