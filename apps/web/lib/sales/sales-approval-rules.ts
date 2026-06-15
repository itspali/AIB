export type SalesApprovalRuleType =
  | "LINE_QTY_ABOVE"
  | "LINE_PRICE_BELOW_LIST"
  | "LINE_DISCOUNT_ABOVE";

export type SalesApprovalRule = {
  type: SalesApprovalRuleType;
  enabled: boolean;
  /** Quantity or discount % threshold. */
  threshold?: number | null;
  /** Allowed % below list price before the rule fires (price rule only). */
  tolerance_percent?: number | null;
};

export const SALES_APPROVAL_RULE_DEFINITIONS: ReadonlyArray<{
  type: SalesApprovalRuleType;
  label: string;
  description: string;
  usesThreshold: boolean;
  usesTolerance: boolean;
  thresholdLabel?: string;
  toleranceLabel?: string;
}> = [
  {
    type: "LINE_QTY_ABOVE",
    label: "Line quantity too high",
    description: "Require approval when any line quantity is above your limit.",
    usesThreshold: true,
    usesTolerance: false,
    thresholdLabel: "Quantity above",
  },
  {
    type: "LINE_PRICE_BELOW_LIST",
    label: "Price below list rate",
    description: "Unit selling price is lower than the item catalog list price.",
    usesThreshold: false,
    usesTolerance: true,
    toleranceLabel: "Allow up to (% below list)",
  },
  {
    type: "LINE_DISCOUNT_ABOVE",
    label: "Line discount too high",
    description: "Require approval when a line discount percentage exceeds your limit.",
    usesThreshold: true,
    usesTolerance: false,
    thresholdLabel: "Discount above (%)",
  },
];

const LEGACY_PO_RULE_TYPES = new Set([
  "LINE_PRICE_ABOVE_SUPPLIER",
  "LINE_PRICE_ABOVE_CATALOG",
]);

export function defaultSalesApprovalRules(): SalesApprovalRule[] {
  return SALES_APPROVAL_RULE_DEFINITIONS.map((def) => ({
    type: def.type,
    enabled: false,
    threshold:
      def.type === "LINE_QTY_ABOVE" ? 100 : def.type === "LINE_DISCOUNT_ABOVE" ? 10 : null,
    tolerance_percent: def.type === "LINE_PRICE_BELOW_LIST" ? 0 : null,
  }));
}

export function normalizeSalesApprovalRules(raw: unknown): SalesApprovalRule[] {
  const defaults = defaultSalesApprovalRules();
  if (!Array.isArray(raw)) return defaults;

  return defaults.map((def) => {
    const match = raw.find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        (entry as SalesApprovalRule).type === def.type
    ) as SalesApprovalRule | undefined;

    if (!match) return def;

    const threshold =
      typeof match.threshold === "number" && Number.isFinite(match.threshold)
        ? match.threshold
        : def.threshold;

    const tolerance =
      typeof match.tolerance_percent === "number" &&
      Number.isFinite(match.tolerance_percent)
        ? match.tolerance_percent
        : def.tolerance_percent;

    return {
      type: def.type,
      enabled: Boolean(match.enabled),
      threshold,
      tolerance_percent: tolerance,
    };
  });
}

/** Map legacy procurement rule payloads saved under sales keys to sales defaults. */
export function migrateLegacySalesApprovalRules(raw: unknown): SalesApprovalRule[] {
  if (!Array.isArray(raw)) return defaultSalesApprovalRules();

  const hasOnlyLegacyPoRules = raw.every(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      LEGACY_PO_RULE_TYPES.has((entry as { type?: string }).type ?? "")
  );

  if (hasOnlyLegacyPoRules) {
    return defaultSalesApprovalRules();
  }

  return normalizeSalesApprovalRules(raw);
}

export function describeSalesApprovalRule(rule: SalesApprovalRule): string {
  const def = SALES_APPROVAL_RULE_DEFINITIONS.find((entry) => entry.type === rule.type);
  if (!def || !rule.enabled) return "";

  if (rule.type === "LINE_QTY_ABOVE") {
    const qty = rule.threshold ?? 0;
    return `Any line quantity above ${qty.toLocaleString()} requires approval.`;
  }

  if (rule.type === "LINE_DISCOUNT_ABOVE") {
    const pct = rule.threshold ?? 0;
    return `Line discount above ${pct}% requires approval.`;
  }

  const tolerance = rule.tolerance_percent ?? 0;
  return tolerance > 0
    ? `Unit price more than ${tolerance}% below the list rate requires approval.`
    : "Unit price below the catalog list rate requires approval.";
}

export function hasEnabledSalesApprovalRules(rules: SalesApprovalRule[]): boolean {
  return rules.some((rule) => rule.enabled);
}
