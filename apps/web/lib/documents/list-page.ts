import { DOCUMENT_LIST_PAGE_SIZE } from "@/lib/documents/list-page-size";

export type DocumentListPage<TRow> = {
  rows: TRow[];
  totalCount: number;
  pageSize: number;
  hasMore: boolean;
};

export type DocumentListFetchOptions = {
  offset?: number;
  limit?: number;
};

export function resolveDocumentListPaging(options?: DocumentListFetchOptions): {
  offset: number;
  limit: number;
} {
  return {
    offset: options?.offset ?? 0,
    limit: options?.limit ?? DOCUMENT_LIST_PAGE_SIZE,
  };
}

export function buildDocumentListPage<TRow>(
  rows: TRow[],
  totalCount: number,
  offset: number,
  limit: number
): DocumentListPage<TRow> {
  return {
    rows,
    totalCount,
    pageSize: limit,
    hasMore: offset + rows.length < totalCount,
  };
}
