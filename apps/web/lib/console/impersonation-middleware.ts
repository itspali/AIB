/** Edge-safe impersonation peek for middleware routing only (no signature verify). */

export type ImpersonationPeek = {
  tenantId: string;
  mode?: "READ_ONLY" | "WRITE";
  exp: number;
};

export const IMPERSONATION_COOKIE_NAME = "aib-console-impersonation";

function decodeBase64Url(value: string): string {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (typeof atob === "function") {
    return atob(base64);
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

export function peekImpersonationPayload(raw: string | undefined): ImpersonationPeek | null {
  if (!raw) return null;
  const [body] = raw.split(".");
  if (!body) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(body)) as ImpersonationPeek & {
      tenantId?: string;
      mode?: "READ_ONLY" | "WRITE";
      exp?: number;
    };
    if (!payload.tenantId || !payload.exp || payload.exp < Date.now()) return null;
    return {
      tenantId: payload.tenantId,
      mode: payload.mode ?? "READ_ONLY",
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function peekImpersonationTenant(raw: string | undefined): string | null {
  return peekImpersonationPayload(raw)?.tenantId ?? null;
}
