import { describe, expect, it } from "vitest";
import {
  countNotApplicablePostingSteps,
  filterApplicablePostingSteps,
  resolveVisiblePostingSteps,
} from "@/lib/documents/posting-step-visibility";
import type { PostingStepResult } from "@/lib/documents/posting-types";

const sampleSteps: PostingStepResult[] = [
  { id: "grn_receipt_recorded", status: "success", detail: "GRN-1" },
  { id: "grn_orphan_sample_quarantined", status: "skipped", detail: null },
  { id: "grn_landed_charges_allocated", status: "skipped", detail: null },
  { id: "grn_po_fulfillment_updated", status: "success", detail: "2 line(s)" },
];

describe("posting step visibility", () => {
  it("counts skipped and not_run as not applicable", () => {
    expect(countNotApplicablePostingSteps(sampleSteps)).toBe(2);
  });

  it("filters to success and failure only", () => {
    expect(filterApplicablePostingSteps(sampleSteps).map((step) => step.id)).toEqual([
      "grn_receipt_recorded",
      "grn_po_fulfillment_updated",
    ]);
  });

  it("returns all steps when expanded", () => {
    expect(resolveVisiblePostingSteps(sampleSteps, true)).toHaveLength(4);
  });

  it("returns applicable steps when collapsed", () => {
    expect(resolveVisiblePostingSteps(sampleSteps, false)).toHaveLength(2);
  });
});
