/** Edge-safe impersonation helpers for middleware routing (HMAC verified). */

export type ImpersonationPeek = {
  sessionId: string;
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

function encodeBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  const base64 =
    typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function signImpersonationBody(body: string, secret: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const key = await subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return encodeBase64Url(signature);
}

function parseImpersonationPeek(body: string): ImpersonationPeek | null {
  try {
    const payload = JSON.parse(decodeBase64Url(body)) as ImpersonationPeek & {
      sessionId?: string;
      tenantId?: string;
      mode?: "READ_ONLY" | "WRITE";
      exp?: number;
    };
    if (!payload.sessionId || !payload.tenantId || !payload.exp || payload.exp < Date.now()) {
      return null;
    }
    return {
      sessionId: payload.sessionId,
      tenantId: payload.tenantId,
      mode: payload.mode ?? "READ_ONLY",
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export async function verifyImpersonationPayload(
  raw: string | undefined,
): Promise<ImpersonationPeek | null> {
  if (!raw) return null;
  const secret = process.env.CONSOLE_IMPERSONATION_SECRET;
  if (!secret) return null;

  const [body, signature] = raw.split(".");
  if (!body || !signature) return null;

  const expected = await signImpersonationBody(body, secret);
  if (!expected || !timingSafeEqualStrings(signature, expected)) return null;

  return parseImpersonationPeek(body);
}

/** @deprecated Use verifyImpersonationPayload for security-sensitive routing. */
export function peekImpersonationPayload(raw: string | undefined): ImpersonationPeek | null {
  if (!raw) return null;
  const [body] = raw.split(".");
  if (!body) return null;
  return parseImpersonationPeek(body);
}

export async function verifyImpersonationTenant(raw: string | undefined): Promise<string | null> {
  const payload = await verifyImpersonationPayload(raw);
  return payload?.tenantId ?? null;
}

export function peekImpersonationTenant(raw: string | undefined): string | null {
  return peekImpersonationPayload(raw)?.tenantId ?? null;
}
