import {
  resolveDefaultRouteToQc,
  resolveLineRouteToQc,
  type QcPolicyContext,
  type VariantQcPolicyHint,
} from "@/lib/procurement/qc-receipt-policy";

export type GrnLineQcRouteUi = {
  defaultRoute: boolean;
  effectiveRoute: boolean;
  canOverride: boolean;
  title: string;
  description: string;
  badgeLabel: string;
  badgeVariant: "action_required" | "completed" | "locked";
};

function policySourceLabel(
  hint: Pick<VariantQcPolicyHint, "item_policy" | "category_policy"> | null,
  defaultRoute: boolean
): string {
  if (!hint) {
    return defaultRoute
      ? "Organization default requires inspection before stocking."
      : "Organization default posts accepted qty direct to stock.";
  }

  if (hint.item_policy === "REQUIRED") {
    return "Item policy requires inspection before stocking.";
  }
  if (hint.item_policy === "EXEMPT") {
    return "Item policy exempts this SKU from inspection hold.";
  }
  if (hint.category_policy === "REQUIRED") {
    return "Category policy requires inspection before stocking.";
  }
  if (hint.category_policy === "EXEMPT") {
    return "Category policy exempts this SKU from inspection hold.";
  }

  return defaultRoute
    ? "Organization default requires inspection before stocking."
    : "Organization default posts accepted qty direct to stock.";
}

function lockedBadge(
  defaultRoute: boolean,
  hint: Pick<VariantQcPolicyHint, "item_policy" | "category_policy"> | null
): Pick<GrnLineQcRouteUi, "badgeLabel" | "badgeVariant" | "title"> {
  const explicitRequired =
    hint?.item_policy === "REQUIRED" || hint?.category_policy === "REQUIRED";
  const explicitExempt =
    hint?.item_policy === "EXEMPT" || hint?.category_policy === "EXEMPT";

  if (explicitRequired || (defaultRoute && !explicitExempt)) {
    return {
      title: explicitRequired ? "QC required" : "QC hold",
      badgeLabel: explicitRequired ? "QC required" : "Into QC hold",
      badgeVariant: "action_required",
    };
  }

  return {
    title: explicitExempt ? "QC exempt" : "Direct to stock",
    badgeLabel: explicitExempt ? "QC exempt" : "Direct to stock",
    badgeVariant: "completed",
  };
}

export function resolveGrnLineQcRouteUi(
  context: QcPolicyContext,
  hint: Pick<VariantQcPolicyHint, "item_policy" | "category_policy"> | null,
  lineRouteToQc: boolean
): GrnLineQcRouteUi {
  const defaultRoute = hint
    ? resolveDefaultRouteToQc(context, hint)
    : context.orgDefaultRouteToQc;
  const canOverride = context.qcModuleEnabled && context.allowLineOverride;
  const effectiveRoute = canOverride
    ? lineRouteToQc
    : resolveLineRouteToQc(context, hint ?? { item_policy: "INHERIT", category_policy: null }, undefined);

  if (!canOverride) {
    const badge = lockedBadge(defaultRoute, hint);
    return {
      defaultRoute,
      effectiveRoute,
      canOverride: false,
      title: badge.title,
      description: `${policySourceLabel(hint, defaultRoute)} Per-line overrides are disabled in procurement settings.`,
      badgeLabel: badge.badgeLabel,
      badgeVariant: badge.badgeVariant,
    };
  }

  return {
    defaultRoute,
    effectiveRoute,
    canOverride: true,
    title: "Route to QC hold",
    description: `Policy default: ${defaultRoute ? "inspection hold" : "direct to stock"}. Toggle to override for this receipt.`,
    badgeLabel: effectiveRoute ? "Into QC hold" : "Direct to stock",
    badgeVariant: effectiveRoute ? "action_required" : "completed",
  };
}
