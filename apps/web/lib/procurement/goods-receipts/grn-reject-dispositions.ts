export const GRN_REJECT_DISPOSITIONS = ["RTV", "SCRAP", "DAMAGE", "SHRINK"] as const;

export type GrnRejectDisposition = (typeof GRN_REJECT_DISPOSITIONS)[number];

const GRN_REJECT_DISPOSITION_LABELS: Record<GrnRejectDisposition, string> = {
  RTV: "Return to vendor",
  SCRAP: "Scrap",
  DAMAGE: "Damage write-off",
  SHRINK: "Shrinkage",
};

export function grnRejectDispositionLabel(disposition: GrnRejectDisposition): string {
  return GRN_REJECT_DISPOSITION_LABELS[disposition];
}
