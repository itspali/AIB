export type BillMatchStatus = "MATCHED" | "PPV_HOLD" | "VARIANCE";

export function billMatchStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "PPV_HOLD":
      return "On hold (PPV)";
    case "VARIANCE":
      return "Within tolerance";
    case "MATCHED":
      return "Matched";
    default:
      return status?.trim() || "Unknown";
  }
}

export function computePriceVariancePct(
  invoicePrice: number,
  referencePrice: number
): number | null {
  if (!Number.isFinite(invoicePrice) || !Number.isFinite(referencePrice) || referencePrice <= 0) {
    return null;
  }
  return Math.abs(((invoicePrice - referencePrice) / referencePrice) * 100);
}

export function resolveBillLineMatchSeverity(
  variancePct: number | null,
  tolerancePct: number
): "matched" | "variance" | "hold" {
  if (variancePct == null || variancePct <= 0) return "matched";
  if (variancePct > tolerancePct) return "hold";
  return "variance";
}

export function aggregateBillMatchSeverity(
  lineSeverities: readonly ("matched" | "variance" | "hold")[],
  tolerancePct: number
): BillMatchStatus {
  if (lineSeverities.some((severity) => severity === "hold")) return "PPV_HOLD";
  if (lineSeverities.some((severity) => severity === "variance")) return "VARIANCE";
  void tolerancePct;
  return "MATCHED";
}

export type BillLineQuantitySeverity = "matched" | "overage";

export function computeQuantityOverage(
  quantityBilled: number,
  quantityOnGrns: number,
  quantityAlreadyInvoiced = 0
): number | null {
  if (!Number.isFinite(quantityBilled) || !Number.isFinite(quantityOnGrns)) {
    return null;
  }
  const allowed = Math.max(quantityOnGrns - quantityAlreadyInvoiced, 0);
  const overage = quantityBilled - allowed;
  return overage > 0 ? overage : 0;
}

export function resolveBillLineQuantitySeverity(
  quantityBilled: number,
  quantityOnGrns: number,
  quantityAlreadyInvoiced = 0
): BillLineQuantitySeverity {
  const overage = computeQuantityOverage(quantityBilled, quantityOnGrns, quantityAlreadyInvoiced);
  if (overage == null || overage <= 0) return "matched";
  return "overage";
}

export function computeQuantityVariancePct(
  quantityBilled: number,
  quantityOnGrns: number,
  quantityAlreadyInvoiced = 0
): number | null {
  if (!Number.isFinite(quantityBilled) || !Number.isFinite(quantityOnGrns)) {
    return null;
  }
  const allowed = Math.max(quantityOnGrns - quantityAlreadyInvoiced, 0);
  if (allowed <= 0) return quantityBilled > 0 ? 100 : null;
  const overage = Math.max(quantityBilled - allowed, 0);
  if (overage <= 0) return 0;
  return (overage / allowed) * 100;
}
