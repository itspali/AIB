import "server-only";

import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decodeImpersonationCookie,
  IMPERSONATION_COOKIE_NAME,
  type ImpersonationPayload,
} from "./impersonation-cookie";

export type { ImpersonationPayload };
export { encodeImpersonationCookie, IMPERSONATION_COOKIE_NAME } from "./impersonation-cookie";

export async function validateImpersonationSession(
  admin: SupabaseClient,
  sessionId: string
): Promise<boolean> {
  const { data } = await admin
    .from("app_console_impersonation_sessions")
    .select("id, expires_at, ended_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (!data || data.ended_at) return false;
  return new Date(data.expires_at).getTime() > Date.now();
}

export async function readImpersonationFromCookies(): Promise<ImpersonationPayload | null> {
  const headerStore = await headers();
  const raw = headerStore.get("cookie") ?? "";
  const match = raw.match(new RegExp(`${IMPERSONATION_COOKIE_NAME}=([^;]+)`));
  const payload = decodeImpersonationCookie(match?.[1]);
  if (!payload) return null;

  const admin = createAdminClient();
  if (!admin) return null;

  const valid = await validateImpersonationSession(admin, payload.sessionId);
  if (!valid) return null;

  return payload;
}

export async function assertNotReadOnlyImpersonation(): Promise<void> {
  const payload = await readImpersonationFromCookies();
  if (payload?.mode === "READ_ONLY") {
    throw new Error("Impersonation is read-only. Exit impersonation to make changes.");
  }
}
