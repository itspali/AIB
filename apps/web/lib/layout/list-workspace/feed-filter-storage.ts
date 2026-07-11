export function listFeedFilterStorageKey(moduleId: string): string {
  return `aib-list-feed-filter:${moduleId}`;
}

export function readListFeedFilterQuery(moduleId: string): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(listFeedFilterStorageKey(moduleId));
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}

export function persistListFeedFilterQuery(moduleId: string, query: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = listFeedFilterStorageKey(moduleId);
    const normalized = query.trim();
    if (!normalized) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, query);
  } catch {
    /* ignore quota errors */
  }
}
