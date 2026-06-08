import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionClaims = {
  userId: string;
  email: string | null;
  tenantId: string | null;
  groupId: string | null;
  appMetadata: Record<string, unknown>;
  userMetadata: Record<string, unknown>;
};

function toSessionClaims(claims: Record<string, unknown> | null | undefined): SessionClaims | null {
  if (!claims || typeof claims.sub !== "string") return null;

  const appMetadata =
    claims.app_metadata && typeof claims.app_metadata === "object"
      ? (claims.app_metadata as Record<string, unknown>)
      : {};
  const userMetadata =
    claims.user_metadata && typeof claims.user_metadata === "object"
      ? (claims.user_metadata as Record<string, unknown>)
      : {};

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    tenantId: typeof appMetadata.tenant_id === "string" ? appMetadata.tenant_id : null,
    groupId: typeof appMetadata.group_id === "string" ? appMetadata.group_id : null,
    appMetadata,
    userMetadata,
  };
}

/**
 * Builds a minimal `User`-shaped object from verified claims so existing
 * helpers that expect a Supabase `User` keep working without a `getUser()` call.
 */
export function claimsToUserShape(claims: SessionClaims): {
  id: string;
  email: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
} {
  return {
    id: claims.userId,
    email: claims.email,
    app_metadata: claims.appMetadata,
    user_metadata: claims.userMetadata,
  };
}

/**
 * Verifies a Supabase client's session and returns the JWT claims.
 *
 * Uses `getClaims()` instead of `getUser()`: the project signs tokens with an
 * asymmetric (ES256) key, so the JWT is verified locally against the cached
 * JWKS with no Auth-server round-trip. `getUser()` always hits the network.
 *
 * Works with both the server and browser Supabase clients, so this module is
 * intentionally free of any `server-only` marker.
 */
export async function readSessionClaims(
  supabase: SupabaseClient
): Promise<SessionClaims | null> {
  const { data, error } = await supabase.auth.getClaims();
  if (error) return null;
  return toSessionClaims(data?.claims as Record<string, unknown> | undefined);
}
