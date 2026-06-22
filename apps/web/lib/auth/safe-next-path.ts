const DEFAULT_TENANT_PATH = "/dashboard";
const DEFAULT_CONSOLE_PATH = "/console";

/** Prevent open redirects; allow only same-origin relative paths. */
export function resolveSafeNextPath(next: string | null | undefined, fallback = DEFAULT_TENANT_PATH): string {
  if (!next) return fallback;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("\\") || trimmed.includes("\0")) return fallback;
  return trimmed;
}

export function defaultPathAfterLogin(hasTenant: boolean, next: string | null): string {
  const safeNext = resolveSafeNextPath(next, hasTenant ? DEFAULT_TENANT_PATH : "/signup?resume=1");
  if (safeNext.startsWith("/console")) return safeNext;
  return safeNext;
}

export { DEFAULT_CONSOLE_PATH };
