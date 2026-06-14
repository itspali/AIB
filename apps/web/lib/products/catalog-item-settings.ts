import type { SupabaseClient } from "@supabase/supabase-js";

export const SCAN_IDENTIFIER_POLICIES = ["GTIN_THEN_SKU", "GTIN", "SKU"] as const;

export type ScanIdentifierPolicy = (typeof SCAN_IDENTIFIER_POLICIES)[number];

export type CatalogItemSettings = {
  scan_identifier_policy: ScanIdentifierPolicy;
  sku_auto_generation_enabled: boolean;
  /** Pattern tokens: {PREFIX}, {SEQ:n} (e.g. {SEQ:6}). */
  sku_auto_pattern: string;
  sku_auto_prefix: string;
};

export const DEFAULT_CATALOG_ITEM_SETTINGS: CatalogItemSettings = {
  scan_identifier_policy: "GTIN_THEN_SKU",
  sku_auto_generation_enabled: false,
  sku_auto_pattern: "{PREFIX}-{SEQ:6}",
  sku_auto_prefix: "ITEM",
};

export function isScanIdentifierPolicy(value: string): value is ScanIdentifierPolicy {
  return (SCAN_IDENTIFIER_POLICIES as readonly string[]).includes(value);
}

export function parseCatalogItemSettings(raw: unknown): CatalogItemSettings {
  const config = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const policy = config.scan_identifier_policy;
  const policyStr = String(policy ?? "");
  return {
    scan_identifier_policy: isScanIdentifierPolicy(policyStr)
      ? policyStr
      : DEFAULT_CATALOG_ITEM_SETTINGS.scan_identifier_policy,
    sku_auto_generation_enabled: Boolean(config.sku_auto_generation_enabled),
    sku_auto_pattern:
      typeof config.sku_auto_pattern === "string" && config.sku_auto_pattern.trim()
        ? config.sku_auto_pattern.trim()
        : DEFAULT_CATALOG_ITEM_SETTINGS.sku_auto_pattern,
    sku_auto_prefix:
      typeof config.sku_auto_prefix === "string" && config.sku_auto_prefix.trim()
        ? config.sku_auto_prefix.trim()
        : DEFAULT_CATALOG_ITEM_SETTINGS.sku_auto_prefix,
  };
}

/** Stored GTIN value (DB column `barcode`). Empty string when unset. */
export function normalizeGtinInput(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/**
 * Value used when resolving scans/labels: respects tenant scan policy.
 * Does not mutate stored data — SKU fallback is runtime only unless GTIN is stored.
 */
export function resolveScannableCode(
  sku: string | null | undefined,
  gtin: string | null | undefined,
  policy: ScanIdentifierPolicy = DEFAULT_CATALOG_ITEM_SETTINGS.scan_identifier_policy
): string | null {
  const skuTrim = (sku ?? "").trim();
  const gtinTrim = (gtin ?? "").trim();

  switch (policy) {
    case "GTIN":
      return gtinTrim || null;
    case "SKU":
      return skuTrim || null;
    case "GTIN_THEN_SKU":
    default:
      return gtinTrim || skuTrim || null;
  }
}

export function scanIdentifierPolicyLabel(policy: ScanIdentifierPolicy): string {
  switch (policy) {
    case "GTIN":
      return "GTIN only";
    case "SKU":
      return "SKU only";
    case "GTIN_THEN_SKU":
      return "GTIN, then SKU if blank";
  }
}

export function gtinFieldHint(policy: ScanIdentifierPolicy): string {
  const example = " Example: 8901234567890.";
  switch (policy) {
    case "GTIN":
      return `Optional UPC/EAN from the package. Scanning uses GTIN only.${example}`;
    case "SKU":
      return `Optional UPC/EAN for marketplaces. Scanning uses your SKU — leave GTIN blank if the label shows SKU only.${example}`;
    case "GTIN_THEN_SKU":
    default:
      return `Optional UPC/EAN from the package. If blank, scanning uses SKU.${example}`;
  }
}

export function skuFieldHint(settings: CatalogItemSettings, isCreate: boolean): string {
  if (isCreate && settings.sku_auto_generation_enabled) {
    return "Your internal product code. Leave blank to auto-generate on save using your workspace pattern.";
  }
  return "Your internal product code. Example: ITEM-001.";
}

function formatSequence(segment: string, width: number): string {
  const parsed = Number(segment);
  if (!Number.isFinite(parsed) || parsed < 0) return String(segment);
  return String(Math.floor(parsed)).padStart(width, "0");
}

/** Build a SKU from pattern and sequence counter (does not increment). */
export function formatSkuFromPattern(
  settings: CatalogItemSettings,
  sequenceValue: number
): string {
  const prefix = settings.sku_auto_prefix.trim() || DEFAULT_CATALOG_ITEM_SETTINGS.sku_auto_prefix;
  let composed = settings.sku_auto_pattern.trim() || DEFAULT_CATALOG_ITEM_SETTINGS.sku_auto_pattern;

  composed = composed.replace(/\{PREFIX\}/gi, prefix);
  composed = composed.replace(/\{SEQ:(\d+)\}/gi, (_, width: string) =>
    formatSequence(String(sequenceValue), Number(width))
  );
  composed = composed.replace(/\{SEQ\}/gi, formatSequence(String(sequenceValue), 6));
  composed = composed
    .replace(/\{[^{}]+\}/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");

  return composed || `${prefix}-${formatSequence(String(sequenceValue), 6)}`;
}

function readSkuSequence(config: Record<string, unknown>): number {
  const raw = config.item_sku_next_value;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

/** Allocate the next SKU and persist the incremented counter on the tenant. */
export async function allocateNextItemSku(
  supabase: SupabaseClient,
  tenantId: string,
  settings: CatalogItemSettings = DEFAULT_CATALOG_ITEM_SETTINGS
): Promise<string> {
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("accounting_config")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const config =
    tenant?.accounting_config && typeof tenant.accounting_config === "object"
      ? (tenant.accounting_config as Record<string, unknown>)
      : {};

  const sequenceValue = readSkuSequence(config);
  const sku = formatSkuFromPattern(settings, sequenceValue);

  const nextConfig = {
    ...config,
    item_sku_next_value: sequenceValue + 1,
  };

  const { error: updateError } = await supabase
    .from("tenants")
    .update({ accounting_config: nextConfig })
    .eq("id", tenantId);

  if (updateError) throw new Error(updateError.message);

  return sku;
}
