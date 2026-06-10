import type { DocumentLayoutTemplate } from "@/lib/documents/types";

const STORAGE_KEY = "aib-po-screen-layout-overrides";

type LocalPoLayoutOverrides = {
  lineColumnOrder?: string[];
  headerFieldOrder?: string[];
  totalsFieldOrder?: string[];
  catalogLineFieldOrder?: string[];
  hiddenColumnIds?: string[];
};

function readOverrides(): LocalPoLayoutOverrides | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalPoLayoutOverrides;
  } catch {
    return null;
  }
}

export function clearPoScreenLayoutLocalOverrides(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function hasPoScreenLayoutLocalOverrides(): boolean {
  return readOverrides() != null;
}

/** Merge optional per-user screen overrides (visibility/order only) onto tenant layout. */
export function mergePoScreenLayoutLocalOverrides(
  layout: DocumentLayoutTemplate
): DocumentLayoutTemplate {
  const overrides = readOverrides();
  if (!overrides) return layout;

  const hidden = new Set(overrides.hiddenColumnIds ?? []);
  const columns = layout.columns.map((column) =>
    hidden.has(column.id) ? { ...column, defaultVisible: false } : column
  );

  return {
    ...layout,
    columns,
    lineColumnOrder: overrides.lineColumnOrder ?? layout.lineColumnOrder,
    headerFieldOrder: overrides.headerFieldOrder ?? layout.headerFieldOrder,
    totalsFieldOrder: overrides.totalsFieldOrder ?? layout.totalsFieldOrder,
    catalogLineFieldOrder: overrides.catalogLineFieldOrder ?? layout.catalogLineFieldOrder,
  };
}

export function savePoScreenLayoutLocalOverrides(overrides: LocalPoLayoutOverrides): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* ignore */
  }
}
