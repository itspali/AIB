"use server";

import { revalidatePath } from "next/cache";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import type { SystemCategoryFormValues } from "@/lib/categories/types";

export async function saveSystemCategory(values: SystemCategoryFormValues) {
  const { supabase } = await requireTenantId();

  const name = values.name.trim();
  if (!name) return { error: "Category name is required" };

  const templates = values.attribute_templates
    .filter((t) => t.key.trim())
    .map((t) => ({
      key: t.key.trim(),
      label: t.label.trim() || t.key.trim(),
      type: t.type,
      required: Boolean(t.required),
    }));

  const { data, error } = await supabase.rpc("save_system_category", {
    p_name: name,
    p_parent_id: values.parent_id,
    p_is_active: values.is_active,
    p_attribute_templates: templates,
  });

  if (error) return { error: error.message };

  revalidatePath("/items/categories");
  revalidatePath("/items");
  return { success: true as const, categoryId: data as string };
}
