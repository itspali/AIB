import "server-only";

import { createClient } from "@/lib/supabase/server";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";

async function refreshAuthSession(): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.auth.refreshSession();
  return error?.message ?? null;
}

/** Used when impersonation starts/ends (Server Actions can write cookies). */
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
