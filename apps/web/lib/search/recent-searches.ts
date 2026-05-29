import type { FilterScope } from "@/lib/search/types";

const STORAGE_KEY = "omnibar:recent:v1";
const MAX_PER_SCOPE = 8;

type RecentStore = Partial<Record<FilterScope, string[]>>;

function readStore(): RecentStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RecentStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: RecentStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore quota / serialization failures; recent searches are best-effort.
  }
}

export function getRecentSearches(scope: FilterScope): string[] {
  return readStore()[scope] ?? [];
}

export function addRecentSearch(scope: FilterScope, query: string): void {
  const trimmed = query.trim();
  if (!trimmed) return;

  const store = readStore();
  const existing = store[scope] ?? [];
  const deduped = existing.filter(
    (entry) => entry.toLowerCase() !== trimmed.toLowerCase()
  );
  store[scope] = [trimmed, ...deduped].slice(0, MAX_PER_SCOPE);
  writeStore(store);
}

export function clearRecentSearches(scope?: FilterScope): void {
  if (!scope) {
    writeStore({});
    return;
  }
  const store = readStore();
  delete store[scope];
  writeStore(store);
}
