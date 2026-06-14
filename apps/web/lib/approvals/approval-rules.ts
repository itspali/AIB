export type PoApprovalRuleType =
  | "LINE_QTY_ABOVE"
  | "LINE_PRICE_ABOVE_SUPPLIER"
  | "LINE_PRICE_ABOVE_CATALOG";

export type PoApprovalRule = {
  type: PoApprovalRuleType;
  enabled: boolean;
  /** Quantity threshold or unused for price rules. */
  threshold?: number | null;
  /** Allowed price overrun before the rule fires (price rules only). */
  tolerance_percent?: number | null;
};

export type PoApproverRole = "ADMIN" | "MANAGER";

export const PO_APPROVER_ROLE_OPTIONS: ReadonlyArray<{
  role: PoApproverRole;
  label: string;
  description: string;
}> = [
  {
    role: "ADMIN",
    label: "Admins",
    description: "Workspace admins can approve purchase orders.",
  },
  {
    role: "MANAGER",
    label: "Managers",
    description: "Location managers can approve purchase orders.",
  },
];

export const PO_APPROVAL_RULE_DEFINITIONS: ReadonlyArray<{
  type: PoApprovalRuleType;
  label: string;
  description: string;
  usesThreshold: boolean;
  usesTolerance: boolean;
  thresholdLabel?: string;
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
    type: "LINE_PRICE_ABOVE_SUPPLIER",
    label: "Price above supplier rate",
    description: "Unit price is higher than this supplier's catalog price for the item.",
    usesThreshold: false,
    usesTolerance: true,
  },
  {
    type: "LINE_PRICE_ABOVE_CATALOG",
    label: "Price above item purchase rate",
    description: "Unit price is higher than the item master purchase price.",
    usesThreshold: false,
    usesTolerance: true,
  },
];

export function defaultPoApprovalRules(): PoApprovalRule[] {
  return PO_APPROVAL_RULE_DEFINITIONS.map((def) => ({
    type: def.type,
    enabled: false,
    threshold: def.type === "LINE_QTY_ABOVE" ? 100 : null,
    tolerance_percent: def.usesTolerance ? 0 : null,
  }));
}

export function normalizePoApprovalRules(raw: unknown): PoApprovalRule[] {
  const defaults = defaultPoApprovalRules();
  if (!Array.isArray(raw)) return defaults;

  return defaults.map((def) => {
    const match = raw.find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        (entry as PoApprovalRule).type === def.type
    ) as PoApprovalRule | undefined;

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

export function normalizePoApproverRoles(raw: unknown): PoApproverRole[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<PoApproverRole>(["ADMIN", "MANAGER"]);
  return raw.filter(
    (value): value is PoApproverRole =>
      typeof value === "string" && allowed.has(value as PoApproverRole)
  );
}

export function describePoApprovalRule(rule: PoApprovalRule): string {
  const def = PO_APPROVAL_RULE_DEFINITIONS.find((entry) => entry.type === rule.type);
  if (!def || !rule.enabled) return "";

  if (rule.type === "LINE_QTY_ABOVE") {
    const qty = rule.threshold ?? 0;
    return `Any line quantity above ${qty.toLocaleString()} requires approval.`;
  }

  const tolerance = rule.tolerance_percent ?? 0;
  if (rule.type === "LINE_PRICE_ABOVE_SUPPLIER") {
    return tolerance > 0
      ? `Unit price more than ${tolerance}% above the supplier rate requires approval.`
      : "Unit price above the supplier catalog rate requires approval.";
  }

  return tolerance > 0
    ? `Unit price more than ${tolerance}% above the item purchase rate requires approval.`
    : "Unit price above the item purchase rate requires approval.";
}

export function hasEnabledPoApprovalRules(rules: PoApprovalRule[]): boolean {
  return rules.some((rule) => rule.enabled);
}
