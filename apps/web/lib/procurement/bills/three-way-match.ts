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
