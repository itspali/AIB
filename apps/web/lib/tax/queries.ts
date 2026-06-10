import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isTaxCodeKind,
  type TaxCodeRow,
  type TaxComponentRow,
  type TaxRuleBasis,
  type TaxRuleRow,
} from "@/lib/tax/types";

type RawComponent = {
  name: string | null;
  rate: number | string | null;
  sort_order: number | null;
};

type RawRule = {
  id: string | null;
  basis: string | null;
  threshold_min: number | string | null;
  threshold_max: number | string | null;
  rate: number | string | null;
  effective_from: string | null;
  effective_to: string | null;
};

type RawTaxCode = {
  id: string;
  code: string;
  name: string;
  kind: string;
  rate: number | string | null;
  is_inclusive_default: boolean;
  is_variable: boolean;
  effective_from: string | null;
  effective_to: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tax_code_components: RawComponent[] | null;
  tax_rate_rules: RawRule[] | null;
};

function toNumber(value: number | string | null, fallback = 0): number {
  if (value === null) return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBasis(value: string | null): TaxRuleBasis {
  if (value === "LINE_VALUE" || value === "QTY") return value;
  return "UNIT_PRICE";
}

function mapComponents(raw: RawComponent[] | null): TaxComponentRow[] {
  return (raw ?? [])
    .map((component) => ({
      name: component.name ?? "",
      rate: toNumber(component.rate),
      sort_order: component.sort_order ?? 0,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

function mapRules(raw: RawRule[] | null): TaxRuleRow[] {
  return (raw ?? [])
    .map((rule) => ({
      id: rule.id ?? null,
      basis: normalizeBasis(rule.basis),
      threshold_min: toNumber(rule.threshold_min),
      threshold_max: rule.threshold_max === null ? null : toNumber(rule.threshold_max),
      rate: toNumber(rule.rate),
      effective_from: rule.effective_from,
      effective_to: rule.effective_to,
    }))
    .sort((a, b) => a.threshold_min - b.threshold_min);
}

/** Active tax rules for PO line GST picker (includes statutory components). */
export async function fetchActivePoLineTaxCodeOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<
  Array<{
    id: string;
    code: string;
    name: string;
    rate: number;
    kind: string;
    is_variable: boolean;
    components: TaxComponentRow[];
  }>
> {
  const { data, error } = await supabase
    .from("tax_codes")
    .select(
      "id, code, name, rate, kind, is_variable, tax_code_components ( name, rate, sort_order )"
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");

  if (error || !data) return [];

  return (data as Array<{
    id: string;
    code: string;
    name: string;
    rate: number | string | null;
    kind: string;
    is_variable: boolean;
    tax_code_components: RawComponent[] | null;
  }>).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    rate: toNumber(row.rate),
    kind: row.kind,
    is_variable: Boolean(row.is_variable),
    components: mapComponents(row.tax_code_components),
  }));
}

export async function fetchTaxCodeRows(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TaxCodeRow[]> {
  const { data, error } = await supabase
    .from("tax_codes")
    .select(
      "id, code, name, kind, rate, is_inclusive_default, is_variable, effective_from, effective_to, is_active, created_at, updated_at, tax_code_components ( name, rate, sort_order ), tax_rate_rules ( id, basis, threshold_min, threshold_max, rate, effective_from, effective_to )"
    )
    .eq("tenant_id", tenantId)
    .order("code");

  if (error || !data) return [];

  return (data as RawTaxCode[]).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    kind: isTaxCodeKind(row.kind) ? row.kind : "GST",
    rate: toNumber(row.rate),
    is_inclusive_default: row.is_inclusive_default,
    is_variable: row.is_variable,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    is_active: row.is_active,
    components: mapComponents(row.tax_code_components),
    rules: mapRules(row.tax_rate_rules),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}
