import "server-only";

import { createClient } from "@/lib/supabase/server";
import { readSessionClaims } from "@/lib/supabase/auth";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import type { ImpersonationPayload } from "./impersonation-cookie";

async function refreshAuthSession(): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.auth.refreshSession();
  return error?.message ?? null;
}

export async function applyImpersonationJwt(sessionId: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("console_apply_impersonation_jwt", {
    p_session_id: sessionId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return formatRpcDeployError("console_apply_impersonation_jwt");
    }
    return error.message;
  }

  return refreshAuthSession();
}

export async function restoreImpersonationJwt(sessionId: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("console_restore_impersonation_jwt", {
    p_session_id: sessionId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return formatRpcDeployError("console_restore_impersonation_jwt");
    }
    return error.message;
  }

  return refreshAuthSession();
}

/** Keep JWT tenant_id aligned with the signed impersonation cookie for RLS-backed queries. */
export async function syncImpersonationJwtIfNeeded(
  payload: ImpersonationPayload,
): Promise<string | null> {
  const supabase = await createClient();
  const claims = await readSessionClaims(supabase);
  const jwtSessionId = claims?.appMetadata.console_impersonation_session_id;

  if (
    claims?.tenantId === payload.tenantId &&
    jwtSessionId === payload.sessionId
  ) {
    return null;
  }

  return applyImpersonationJwt(payload.sessionId);
}
