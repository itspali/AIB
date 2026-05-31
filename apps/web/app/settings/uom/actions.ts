"use server";

import { revalidatePath } from "next/cache";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import { uomSchema } from "@/lib/uom/schemas";
import type { UomFormValues } from "@/lib/uom/types";

function toNumber(value: string, fallback = 0): number {
  const trimmed = value.trim();
  if (trimmed === "") return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function saveUom(values: UomFormValues) {
  const parsed = uomSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid unit of measure." };
  }

  const data = parsed.data;
  const { supabase } = await requireTenantId();

  const { data: uomId, error } = await supabase.rpc("save_uom", {
    p_code: data.code.trim(),
    p_name: data.name.trim(),
    p_family: data.family,
    p_factor_to_base: data.is_family_base ? 1 : toNumber(data.factor_to_base, 1),
    p_is_family_base: data.is_family_base,
    p_is_active: data.is_active,
    p_uom_id: data.uom_id ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/settings/uom");
  return { success: true as const, uomId: uomId as string };
}

export async function deleteUom(uomId: string) {
  if (!uomId) return { error: "Unit id is required." };

  const { supabase } = await requireTenantId();

  const { data, error } = await supabase.rpc("delete_uom", {
    p_uom_id: uomId,
  });

  if (error) return { error: error.message };

  revalidatePath("/settings/uom");
  return { success: true as const, outcome: (data as string) ?? "DELETED" };
}

export async function seedDefaultUoms() {
  const { supabase } = await requireTenantId();

  const { data, error } = await supabase.rpc("seed_default_uoms");

  if (error) return { error: error.message };

  revalidatePath("/settings/uom");
  return { success: true as const, created: (data as number) ?? 0 };
}
