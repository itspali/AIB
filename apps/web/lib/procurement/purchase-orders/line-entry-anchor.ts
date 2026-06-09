export type PoLineEntryAnchor = "bottom" | "top";

export const PO_LINE_ENTRY_ANCHOR_STORAGE_KEY = "aib-po-line-entry-anchor";

export const PO_LINE_ENTRY_ANCHOR_LABEL: Record<PoLineEntryAnchor, string> = {
  bottom: "Add at bottom",
  top: "Add at top",
};

export function readPoLineEntryAnchor(): PoLineEntryAnchor {
  if (typeof window === "undefined") return "bottom";
  return sessionStorage.getItem(PO_LINE_ENTRY_ANCHOR_STORAGE_KEY) === "top" ? "top" : "bottom";
}

export function writePoLineEntryAnchor(anchor: PoLineEntryAnchor): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PO_LINE_ENTRY_ANCHOR_STORAGE_KEY, anchor);
}
