"use server";

import { requireTenantId } from "@/lib/supabase/require-tenant";
import { validateFilterAst } from "@/lib/search/executor/validate-ast";
import {
  resolveSearchFieldPermissionsFromSession,
} from "@/lib/search/permissions/resolve-permissions-server";
import {
  assertRegisteredModuleName,
  scopeFromModuleName,
} from "@/lib/search/views/module-view-registry";
import { extractStructuralAst } from "@/lib/search/views/saved-view-utils";
import type {
  AstClause,
  CustomModuleView,
  CustomModuleViewActionResult,
  SaveCustomModuleViewPayload,
  UpdateCustomModuleViewPayload,
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

function mapViewRow(row: Record<string, unknown>): CustomModuleView {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    user_id: String(row.user_id),
    module_name: String(row.module_name),
    view_name: String(row.view_name),
    raw_search_text: String(row.raw_search_text),
    compiled_ast: (row.compiled_ast as AstClause[]) ?? [],
    is_system_default: Boolean(row.is_system_default),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function validateViewAst(
  moduleName: string,
  ast: AstClause[]
): Promise<{ ok: true; ast: AstClause[] } | { ok: false; error: string }> {
  const scope = scopeFromModuleName(moduleName);
  if (!scope) {
    return { ok: false, error: "Unsupported module for saved views." };
  }

  const { supabase, tenantId, userId, role } = await getSessionContext();
  const permissions = await resolveSearchFieldPermissionsFromSession(
    supabase,
    tenantId,
    userId,
    role
  );

  const structural = extractStructuralAst(ast);
  const validation = validateFilterAst(structural, scope, permissions);
  if (!validation.ok) {
    return {
      ok: false,
      error:
        validation.error === "FORBIDDEN_FIELD"
          ? "Saved view uses fields you are not permitted to filter."
          : "Saved view contains invalid filter parameters.",
    };
  }

  return { ok: true, ast: validation.ast };
}

export async function listCustomModuleViews(
  moduleName: string
): Promise<CustomModuleViewActionResult> {
  try {
    if (!assertRegisteredModuleName(moduleName)) {
      return { ok: false, error: "Unsupported module for saved views." };
    }

    const { supabase, tenantId, userId } = await getSessionContext();
    const { data, error } = await supabase
      .from("custom_module_views")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("module_name", moduleName)
      .order("view_name", { ascending: true });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, views: (data ?? []).map(mapViewRow) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load saved views.";
    return { ok: false, error: message };
  }
}

export async function saveCustomModuleView(
  payload: SaveCustomModuleViewPayload
): Promise<CustomModuleViewActionResult> {
  try {
    const trimmedName = payload.viewName.trim();
    const trimmedQuery = payload.rawSearchText.trim();

    if (!assertRegisteredModuleName(payload.moduleName)) {
      return { ok: false, error: "Unsupported module for saved views." };
    }
    if (!trimmedName) {
      return { ok: false, error: "View name is required." };
    }
    if (!trimmedQuery) {
      return { ok: false, error: "Filter query cannot be empty." };
    }

    const validated = await validateViewAst(payload.moduleName, payload.compiledAst);
    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }

    const { supabase, tenantId, userId } = await getSessionContext();
    const { data, error } = await supabase
      .from("custom_module_views")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        module_name: payload.moduleName,
        view_name: trimmedName,
        raw_search_text: trimmedQuery,
        compiled_ast: validated.ast,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "A view with this name already exists." };
      }
      return { ok: false, error: error.message };
    }

    return { ok: true, view: mapViewRow(data) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save view.";
    return { ok: false, error: message };
  }
}

export async function updateCustomModuleView(
  payload: UpdateCustomModuleViewPayload
): Promise<CustomModuleViewActionResult> {
  try {
    const { supabase, tenantId, userId } = await getSessionContext();

    const updates: Record<string, unknown> = {};

    if (payload.viewName !== undefined) {
      const trimmedName = payload.viewName.trim();
      if (!trimmedName) {
        return { ok: false, error: "View name is required." };
      }
      updates.view_name = trimmedName;
    }

    if (payload.rawSearchText !== undefined || payload.compiledAst !== undefined) {
      const { data: existing, error: fetchError } = await supabase
        .from("custom_module_views")
        .select("module_name, raw_search_text, compiled_ast")
        .eq("id", payload.id)
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();

      if (fetchError) {
        return { ok: false, error: fetchError.message };
      }
      if (!existing) {
        return { ok: false, error: "Saved view not found." };
      }

      const nextQuery =
        payload.rawSearchText !== undefined
          ? payload.rawSearchText.trim()
          : String(existing.raw_search_text);
      const nextAst =
        payload.compiledAst !== undefined
          ? payload.compiledAst
          : ((existing.compiled_ast as AstClause[]) ?? []);

      if (!nextQuery) {
        return { ok: false, error: "Filter query cannot be empty." };
      }

      const validated = await validateViewAst(String(existing.module_name), nextAst);
      if (!validated.ok) {
        return { ok: false, error: validated.error };
      }

      updates.raw_search_text = nextQuery;
      updates.compiled_ast = validated.ast;
    }

    if (Object.keys(updates).length === 0) {
      return { ok: false, error: "Nothing to update." };
    }

    const { data, error } = await supabase
      .from("custom_module_views")
      .update(updates)
      .eq("id", payload.id)
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "A view with this name already exists." };
      }
      return { ok: false, error: error.message };
    }

    return { ok: true, view: mapViewRow(data) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update view.";
    return { ok: false, error: message };
  }
}

export async function deleteCustomModuleView(id: string): Promise<CustomModuleViewActionResult> {
  try {
    const { supabase, tenantId, userId } = await getSessionContext();
    const { error } = await supabase
      .from("custom_module_views")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .eq("user_id", userId);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete view.";
    return { ok: false, error: message };
  }
}
