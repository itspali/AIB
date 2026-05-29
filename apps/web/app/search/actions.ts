"use server";

import { requireTenantId } from "@/lib/supabase/require-tenant";
import { buildFieldDict } from "@/lib/search/permissions/resolve-field-dict";
import {
  hashQuery,
  resolveSearchFieldPermissionsFromSession,
} from "@/lib/search/permissions/resolve-permissions-server";
import { executeItemsFilterRpc, normalizeItemsAst } from "@/lib/search/executor/supabase-items";
import { validateFilterAst } from "@/lib/search/executor/validate-ast";
import { scanQueryForSecuritySignatures } from "@/lib/search/telemetry/signatures";import type {
  AstClause,
  FilterScope,
  ModuleFilterResult,
  SearchFieldPermissions,
  TelemetryPayload,
} from "@/lib/search/types";
import type { UserRole } from "@/lib/user/types";

async function getSessionContext() {
  const { supabase, tenantId } = await requireTenantId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const role = (userRow?.role as UserRole | undefined) ?? "STAFF";
  return { supabase, tenantId, userId: user.id, role };
}

export async function resolveSearchFieldPermissions(): Promise<SearchFieldPermissions> {
  const { supabase, tenantId, userId, role } = await getSessionContext();
  return resolveSearchFieldPermissionsFromSession(supabase, tenantId, userId, role);
}

async function logFilterViolation(
  supabase: Awaited<ReturnType<typeof requireTenantId>>["supabase"],
  tenantId: string,
  userId: string,
  scope: FilterScope,
  rawQuery: string,
  attemptedFields: string[],
  severity: "reject" | "throttle"
) {
  const { error } = await supabase.from("search_filter_violations").insert({
    tenant_id: tenantId,
    user_id: userId,
    scope,
    raw_query_hash: hashQuery(rawQuery),
    attempted_fields: attemptedFields,
    severity,
  });

  if (error) {
    console.warn("[search] violation log skipped:", error.message);
  }
}

export async function executeModuleFilter(
  scope: FilterScope,
  ast: AstClause[],
  rawQuery: string
): Promise<ModuleFilterResult> {
  if (scope !== "items") {
    return { ok: true, itemIds: [], executionMs: 0 };
  }

  const started = performance.now();
  const { supabase, tenantId, userId, role } = await getSessionContext();

  const security = scanQueryForSecuritySignatures(rawQuery, `${tenantId}:${userId}`);
  if (security.flagged) {
    await logFilterViolation(supabase, tenantId, userId, scope, rawQuery, security.reasons, "throttle");
    return { ok: false, error: "Search temporarily restricted due to security policy." };
  }

  const permissions = await resolveSearchFieldPermissionsFromSession(
    supabase,
    tenantId,
    userId,
    role
  );
  if (permissions.throttled) {
    return { ok: false, error: "Search temporarily restricted due to security policy." };
  }

  const validation = validateFilterAst(ast, scope, permissions);
  if (!validation.ok) {
    await logFilterViolation(
      supabase,
      tenantId,
      userId,
      scope,
      rawQuery,
      validation.field ? [validation.field] : [],
      "reject"
    );
    return {
      ok: false,
      error: validation.error === "FORBIDDEN_FIELD" ? "Unauthorized filter field." : "Invalid filter.",
      field: validation.field,
    };
  }

  try {
    const normalizedAst = await normalizeItemsAst(supabase, tenantId, validation.ast);
    const itemIds = await executeItemsFilterRpc(supabase, normalizedAst);
    const executionMs = Math.round(performance.now() - started);

    if (executionMs > 50) {
      await logSearchTelemetry({
        scope,
        rawQuery,
        unparsedTokens: [],
        ast,
        compileMicros: 0,
        executionMs,
        performanceWarning: true,
        securityFlag: false,
      });
    }

    return { ok: true, itemIds, executionMs };
  } catch {
    return { ok: false, error: "Unable to execute native filter." };
  }
}

export async function logSearchTelemetry(payload: TelemetryPayload): Promise<void> {
  try {
    const { supabase, tenantId, userId } = await getSessionContext();
    const security = scanQueryForSecuritySignatures(payload.rawQuery, `${tenantId}:${userId}`);

    const { error } = await supabase.from("search_telemetry_logs").insert({
      tenant_id: tenantId,
      user_id: userId,
      scope: payload.scope,
      raw_query: payload.rawQuery,
      unparsed_tokens: payload.unparsedTokens,
      ast_json: payload.ast,
      compile_micros: payload.compileMicros,
      execution_ms: payload.executionMs ?? null,
      performance_warning: payload.performanceWarning ?? (payload.executionMs ?? 0) > 50,
      security_flag: payload.securityFlag ?? security.flagged,
    });

    if (error) {
      console.warn("[search] telemetry insert skipped:", error.message);
    }
  } catch (error) {
    console.warn("[search] telemetry logging failed:", error);
  }
}

export async function compileWithPermissions(
  scope: FilterScope,
  query: string
): Promise<{
  permissions: SearchFieldPermissions;
  fieldDict: ReturnType<typeof buildFieldDict>;
}> {
  const permissions = await resolveSearchFieldPermissions();
  return {
    permissions,
    fieldDict: buildFieldDict(scope, permissions),
  };
}
