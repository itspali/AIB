import { POSTING_STEP_CATALOG } from "@/lib/documents/posting-step-catalog";

export function resolveActivityEventDescription(
  eventCode: string,
  title: string,
  detail: Record<string, unknown>
): string | null {
  const catalogEntry = POSTING_STEP_CATALOG[eventCode];
  if (catalogEntry?.description) {
    return catalogEntry.description;
  }

  if (eventCode === "created") {
    return "This record was first saved in the workspace.";
  }

  if (eventCode === "linked") {
    if (detail.goods_receipt_id) {
      return "A goods receipt was linked to this bill for three-way matching.";
    }
    if (detail.purchase_invoice_id) {
      return "This receipt was linked to a supplier bill.";
    }
    return "Related documents were linked.";
  }

  if (eventCode === "status_changed" && typeof detail.new_status === "string") {
    return `Document status changed to ${detail.new_status.replaceAll("_", " ").toLowerCase()}.`;
  }

  if (typeof detail.decision_notes === "string" && detail.decision_notes.trim()) {
    return detail.decision_notes.trim();
  }

  return null;
}

export function resolveActivityEventLabel(eventCode: string, title: string): string {
  return POSTING_STEP_CATALOG[eventCode]?.label ?? title;
}
