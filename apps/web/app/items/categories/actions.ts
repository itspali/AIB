"use server";

import { revalidatePath } from "next/cache";
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

      return template;
    });
}

export async function saveSystemCategory(values: SystemCategoryFormValues) {
  const { supabase, tenantId } = await requireTenantId();

  const name = values.name.trim();
  if (!name) return { error: "Category name is required" };

  const templates = buildAttributeTemplates(values.attribute_templates);
  const templateError = validateAttributeTemplates(values.attribute_templates);
  if (templateError) return { error: templateError };

  if (values.category_id) {
    return updateSystemCategory(supabase, tenantId, values.category_id, {
      name,
      parent_id: values.parent_id,
      is_active: values.is_active,
      attribute_templates: templates,
      default_variant_strategy: values.default_variant_strategy,
    });
  }

  const { data, error } = await supabase.rpc("save_system_category", {
    p_name: name,
    p_parent_id: values.parent_id,
    p_is_active: values.is_active,
    p_attribute_templates: templates,
    p_default_variant_strategy: values.default_variant_strategy,
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
