"use server";

import { revalidatePath } from "next/cache";
import { finalizeAttributeTemplateRows } from "@/lib/categories/attribute-key";
import { attributeTypeNeedsOptions } from "@/lib/categories/attribute-types";
import { fetchCategoryItemCounts, fetchCategoryRowById, fetchCategoryRows } from "@/lib/categories/queries";
import type { AttributeTemplateEntry, CategoryRow, SystemCategoryFormValues } from "@/lib/categories/types";
import { validateAttributeTemplates } from "@/lib/categories/validate-templates";
import { validateCategoryParentAssignment } from "@/lib/categories/validate-parent";
import { requireTenantId } from "@/lib/supabase/require-tenant";

const CATEGORY_PATHS = ["/items/categories", "/items"] as const;

export async function loadCategoryItemCounts(): Promise<Record<string, number>> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchCategoryItemCounts(supabase, tenantId);
}

export async function loadCategoryRows(): Promise<CategoryRow[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchCategoryRows(supabase, tenantId);
}

function revalidateCategoryPaths() {
  for (const path of CATEGORY_PATHS) {
    revalidatePath(path);
  }
}

function buildAttributeTemplates(
  entries: AttributeTemplateEntry[]
): Record<string, unknown>[] {
  return entries
    .filter((entry) => entry.key.trim())
    .map((entry) => {
      const template: Record<string, unknown> = {
        key: entry.key.trim(),
        label: entry.label.trim() || entry.key.trim(),
        type: entry.type,
        required: Boolean(entry.required),
      };

      if (attributeTypeNeedsOptions(entry.type) && entry.options?.length) {
        template.options = entry.options.map((option) => option.trim()).filter(Boolean);
      }

      if (entry.role === "axis" || entry.role === "descriptive") {
        template.role = entry.role;
      }

      return template;
    });
}

type CategoryMutationSuccess = { success: true; category: CategoryRow };
type CategoryMutationError = { error: string };
type CategoryMutationResult = CategoryMutationSuccess | CategoryMutationError;

export async function saveSystemCategory(
  values: SystemCategoryFormValues
): Promise<CategoryMutationResult> {
  const { supabase, tenantId } = await requireTenantId();

  const name = values.name.trim();
  if (!name) return { error: "Category name is required" };

  const finalizedTemplates = finalizeAttributeTemplateRows(values.attribute_templates);
  const templateError = validateAttributeTemplates(finalizedTemplates);
  if (templateError) return { error: templateError };

  const templates = buildAttributeTemplates(finalizedTemplates);

  if (values.category_id) {
    const { data: parentRows, error: fetchError } = await supabase
      .from("item_categories")
      .select("id, parent_id")
      .eq("tenant_id", tenantId);

    if (fetchError) return { error: fetchError.message };

    const parentError = validateCategoryParentAssignment(
      values.category_id,
      values.parent_id,
      parentRows ?? []
    );
    if (parentError) return { error: parentError };
  }

  const { data: categoryId, error } = await supabase.rpc("save_system_category", {
    p_name: name,
    p_parent_id: values.parent_id,
    p_is_active: values.is_active,
    p_attribute_templates: templates,
    p_category_id: values.category_id ?? null,
    p_default_variant_strategy: values.default_variant_strategy,
    p_inherit_parent_attributes: values.parent_id ? values.inherit_parent_attributes : true,
    p_qc_receipt_policy: values.qc_receipt_policy,
  });

  if (error) return { error: error.message };

  const category = await fetchCategoryRowById(supabase, tenantId, categoryId as string);
  if (!category) return { error: "Category saved but could not be loaded." };

  revalidateCategoryPaths();
  return { success: true, category };
}

async function deleteSystemCategoryInternal(
  supabase: Awaited<ReturnType<typeof requireTenantId>>["supabase"],
  categoryId: string
): Promise<{ ok: true; outcome: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("delete_system_category", {
    p_category_id: categoryId,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, outcome: (data as string) ?? "DELETED" };
}

export async function deleteSystemCategory(categoryId: string) {
  if (!categoryId) return { error: "Category id is required." };

  const { supabase } = await requireTenantId();
  const result = await deleteSystemCategoryInternal(supabase, categoryId);
  if (!result.ok) return { error: result.error };

  revalidateCategoryPaths();
  return { success: true as const, categoryId, outcome: result.outcome };
}

export async function deactivateSystemCategory(categoryId: string) {
  if (!categoryId) return { error: "Category id is required." };

  const { supabase, tenantId } = await requireTenantId();

  const { error } = await supabase
    .from("item_categories")
    .update({ is_active: false })
    .eq("id", categoryId)
    .eq("tenant_id", tenantId)
    .select("id")
    .single();

  if (error) return { error: error.message };

  const category = await fetchCategoryRowById(supabase, tenantId, categoryId);
  if (!category) return { error: "Category updated but could not be loaded." };

  revalidateCategoryPaths();
  return { success: true as const, category };
}

export async function activateSystemCategory(categoryId: string) {
  if (!categoryId) return { error: "Category id is required." };

  const { supabase, tenantId } = await requireTenantId();

  const { data, error } = await supabase
    .from("item_categories")
    .update({ is_active: true })
    .eq("id", categoryId)
    .eq("tenant_id", tenantId)
    .select("id")
    .single();

  if (error) return { error: error.message };
  if (!data) return { error: "Category not found" };

  const category = await fetchCategoryRowById(supabase, tenantId, data.id);
  if (!category) return { error: "Category updated but could not be loaded." };

  revalidateCategoryPaths();
  return { success: true as const, category };
}

function uniqueCategoryIds(categoryIds: string[]): string[] {
  return [...new Set(categoryIds.filter(Boolean))];
}

export async function bulkActivateCategories(categoryIds: string[]) {
  const ids = uniqueCategoryIds(categoryIds);
  if (ids.length === 0) return { error: "Select at least one category." };

  const { supabase, tenantId } = await requireTenantId();

  const { data, error } = await supabase
    .from("item_categories")
    .update({ is_active: true })
    .in("id", ids)
    .eq("tenant_id", tenantId)
    .select("id");

  if (error) return { error: error.message };

  revalidateCategoryPaths();
  return {
    success: true as const,
    affectedIds: (data ?? []).map((row) => row.id as string),
  };
}

export async function bulkDeactivateCategories(categoryIds: string[]) {
  const ids = uniqueCategoryIds(categoryIds);
  if (ids.length === 0) return { error: "Select at least one category." };

  const { supabase, tenantId } = await requireTenantId();

  const { data, error } = await supabase
    .from("item_categories")
    .update({ is_active: false })
    .in("id", ids)
    .eq("tenant_id", tenantId)
    .select("id");

  if (error) return { error: error.message };

  revalidateCategoryPaths();
  return {
    success: true as const,
    affectedIds: (data ?? []).map((row) => row.id as string),
  };
}

export async function bulkDeleteCategories(categoryIds: string[]) {
  const ids = uniqueCategoryIds(categoryIds);
  if (ids.length === 0) return { error: "Select at least one category." };

  const { supabase } = await requireTenantId();

  const results = await Promise.all(
    ids.map(async (categoryId) => ({
      categoryId,
      result: await deleteSystemCategoryInternal(supabase, categoryId),
    }))
  );

  const deletedIds: string[] = [];
  const errors: string[] = [];

  for (const { categoryId, result } of results) {
    if (result.ok) {
      deletedIds.push(categoryId);
      continue;
    }
    errors.push(result.error ?? "Unable to delete category.");
  }

  if (deletedIds.length === 0) {
    return { error: errors[0] ?? "Unable to delete selected categories." };
  }

  revalidateCategoryPaths();
  return {
    success: true as const,
    deletedIds,
    skippedCount: ids.length - deletedIds.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}
