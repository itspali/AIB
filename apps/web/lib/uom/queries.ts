import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isUomFamily, type UomRow } from "@/lib/uom/types";

type RawUom = {
  id: string;
  code: string;
  name: string;
  family: string;
  factor_to_base: number | string | null;
  is_family_base: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function toNumber(value: number | string | null, fallback = 0): number {
  if (value === null) return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function fetchUomRows(
  supabase: SupabaseClient,
  tenantId: string
): Promise<UomRow[]> {
  const { data, error } = await supabase
    .from("uoms")
    .select(
      "id, code, name, family, factor_to_base, is_family_base, is_active, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .order("family")
    .order("factor_to_base");

  if (error || !data) return [];

  return (data as RawUom[]).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    family: isUomFamily(row.family) ? row.family : "COUNT",
    factor_to_base: toNumber(row.factor_to_base, 1),
    is_family_base: row.is_family_base,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}
