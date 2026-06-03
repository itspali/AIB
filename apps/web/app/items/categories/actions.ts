"use server";

import { revalidatePath } from "next/cache";
import { finalizeAttributeTemplateRows } from "@/lib/categories/attribute-key";
import { attributeTypeNeedsOptions } from "@/lib/categories/attribute-types";
import { validateAttributeTemplates } from "@/lib/categories/validate-templates";
import { validateCategoryParentAssignment } from "@/lib/categories/validate-parent";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import type { AttributeTemplateEntry, SystemCategoryFormValues } from "@/lib/categories/types";

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

export async function saveSystemCategory(values: SystemCategoryFormValues) {
  const { supabase, tenantId } = await requireTenantId();

  const name = values.name.trim();
  if (!name) return { error: "Category name is required" };

  const templates = buildAttributeTemplates(
    finalizeAttributeTemplateRows(values.attribute_templates)
  );
  const templateError = validateAttributeTemplates(
    finalizeAttributeTemplateRows(values.attribute_templates)
  );
  if (templateError) return { error: templateError };

  if (values.category_id) {
    return updateSystemCategory(supabase, tenantId, values.category_id, {
      name,
      parent_id: values.parent_id,
      is_active: values.is_active,
      attribute_templates: templates,
      inherit_parent_attributes: values.inherit_parent_attributes,
      default_variant_strategy: values.default_variant_strategy,
    });
  }

  const { data, error } = await supabase.rpc("save_system_category", {
    p_name: name,
    p_parent_id: values.parent_id,
    p_is_active: values.is_active,
    p_attribute_templates: templates,
    p_default_variant_strategy: values.default_variant_strategy,
    p_inherit_parent_attributes: values.inherit_parent_attributes,
  });

  if (error) return { error: error.message };

  revalidatePath("/inventory/categories");
  revalidatePath("/inventory/items");
  return { success: true as const, categoryId: data as string };
}

async function updateSystemCategory(
  supabase: Awaited<ReturnType<typeof requireTenantId>>["supabase"],
  tenantId: string,
  categoryId: string,
  payload: {
    name: string;
    parent_id: string | null;
    is_active: boolean;
    attribute_templates: Record<string, unknown>[];
    inherit_parent_attributes: boolean;
    default_variant_strategy: SystemCategoryFormValues["default_variant_strategy"];
  }
) {
  const { data: rows, error: fetchError } = await supabase
    .from("item_categories")
    .select("id, parent_id")
    .eq("tenant_id", tenantId);

  if (fetchError) return { error: fetchError.message };

  const categoryExists = rows?.some((row) => row.id === categoryId);
  if (!categoryExists) return { error: "Category not found" };

  const parentError = validateCategoryParentAssignment(
    categoryId,
    payload.parent_id,
    rows ?? []
  );
  if (parentError) return { error: parentError };

  const { data, error } = await supabase
    .from("item_categories")
    .update({
      name: payload.name,
      parent_id: payload.parent_id,
      is_active: payload.is_active,
      attribute_templates: payload.attribute_templates,
      inherit_parent_attributes: payload.inherit_parent_attributes,
      default_variant_strategy: payload.default_variant_strategy,
    })
    .eq("id", categoryId)
    .eq("tenant_id", tenantId)
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/inventory/categories");
  revalidatePath("/inventory/items");
  return { success: true as const, categoryId: data.id as string };
}

export async function deleteSystemCategory(categoryId: string) {
  if (!categoryId) return { error: "Category id is required." };

  const { supabase } = await requireTenantId();

  const { data, error } = await supabase.rpc("delete_system_category", {
    p_category_id: categoryId,
  });

  if (error) return { error: error.message };

  revalidatePath("/inventory/categories");
  revalidatePath("/inventory/items");
  return { success: true as const, outcome: (data as string) ?? "DELETED" };
}

export async function deactivateSystemCategory(categoryId: string) {
  if (!categoryId) return { error: "Category id is required." };

  const { supabase, tenantId } = await requireTenantId();

  const { data, error } = await supabase
    .from("item_categories")
    .update({ is_active: false })
    .eq("id", categoryId)
    .eq("tenant_id", tenantId)
    .select("id")
    .single();

  if (error) return { error: error.message };
  if (!data) return { error: "Category not found" };

  revalidatePath("/inventory/categories");
  revalidatePath("/inventory/items");
  return { success: true as const, categoryId: data.id as string };
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

  revalidatePath("/inventory/categories");
  revalidatePath("/inventory/items");
  return { success: true as const, categoryId: data.id as string };
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

  revalidatePath("/inventory/categories");
  revalidatePath("/inventory/items");
  return { success: true as const, affectedCount: data?.length ?? 0 };
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

  revalidatePath("/inventory/categories");
  revalidatePath("/inventory/items");
  return { success: true as const, affectedCount: data?.length ?? 0 };
}

export async function bulkDeleteCategories(categoryIds: string[]) {
  const ids = uniqueCategoryIds(categoryIds);
  if (ids.length === 0) return { error: "Select at least one category." };

  let deletedCount = 0;
  const errors: string[] = [];

  for (const categoryId of ids) {
    const result = await deleteSystemCategory(categoryId);
    if ("error" in result) {
      errors.push(result.error ?? "Unable to delete category.");
      continue;
    }
    deletedCount += 1;
  }

  if (deletedCount === 0) {
    return { error: errors[0] ?? "Unable to delete selected categories." };
  }

  return {
    success: true as const,
    affectedCount: deletedCount,
    skippedCount: ids.length - deletedCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}
