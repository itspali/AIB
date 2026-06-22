import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "aib-console-impersonation";

export type ImpersonationPayload = {
  sessionId: string;
  tenantId: string;
  userId: string | null;
  mode: "READ_ONLY" | "WRITE";
  exp: number;
};

function getSecret(): string | null {
  return process.env.CONSOLE_IMPERSONATION_SECRET ?? null;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function encodeImpersonationCookie(payload: ImpersonationPayload): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(body, secret);
  return `${body}.${signature}`;
}

export function decodeImpersonationCookie(raw: string | undefined): ImpersonationPayload | null {
  const secret = getSecret();
  if (!secret || !raw) return null;
  const [body, signature] = raw.split(".");
  if (!body || !signature) return null;
  const expected = sign(body, secret);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ImpersonationPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export { COOKIE_NAME as IMPERSONATION_COOKIE_NAME };
