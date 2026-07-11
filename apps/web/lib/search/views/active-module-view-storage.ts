const STORAGE_KEY_PREFIX = "aib-module-active-view:";
const COOKIE_KEY_PREFIX = "aib-active-view-";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function activeModuleViewStorageKey(moduleName: string): string {
  return `${STORAGE_KEY_PREFIX}${moduleName}`;
}

export function activeModuleViewCookieName(moduleName: string): string {
  return `${COOKIE_KEY_PREFIX}${moduleName.replace(/[^a-z0-9-]/gi, "_")}`;
}

export function readActiveModuleViewId(moduleName: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(activeModuleViewStorageKey(moduleName));
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function persistActiveModuleViewCookie(moduleName: string, viewId: string | null): void {
  if (typeof document === "undefined") return;
  const cookieName = activeModuleViewCookieName(moduleName);
  if (!viewId) {
    document.cookie = `${cookieName}=; path=/; max-age=0; SameSite=Lax`;
    return;
  }
  document.cookie = `${cookieName}=${encodeURIComponent(viewId)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function persistActiveModuleViewId(moduleName: string, viewId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const key = activeModuleViewStorageKey(moduleName);
    const trimmed = viewId?.trim() ?? "";
    if (!trimmed) {
      localStorage.removeItem(key);
      persistActiveModuleViewCookie(moduleName, null);
      return;
    }
    localStorage.setItem(key, trimmed);
    persistActiveModuleViewCookie(moduleName, trimmed);
  } catch {
    /* ignore quota errors */
  }
}
