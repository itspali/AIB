import { describe, expect, it } from "vitest";
import { DEFAULT_IMPORT_LOGISTICS_SETTINGS } from "@/lib/procurement/import-logistics-settings-shared";
import {
  grnReceiptStageLabel,
  resolveBoeRequirement,
  resolveGrnReceiptContext,
} from "@/lib/procurement/import-logistics/receipt-context";

const stagingGitSettings = {
  ...DEFAULT_IMPORT_LOGISTICS_SETTINGS,
  import_receipt_document_strategy: "SEPARATE_GRNS_PER_STAGE" as const,
  import_receipt_mode: "STAGING_THEN_GIT" as const,
  po_fulfillment_stage: "COMMERCIAL" as const,
};

const po = {
  id: "po-1",
  receipt_location_id: "staging-loc",
  ultimate_destination_location_id: "main-loc",
  destination_location_id: "main-loc",
  po_fulfillment_stage_override: null,
  tax_supply_nature: "IMPORT_GOODS",
};

describe("resolveBoeRequirement", () => {
  it("skips BoE for domestic supply", () => {
    expect(resolveBoeRequirement("FINAL", "INTERSTATE", "ALWAYS", false)).toBe(false);
  });

  it("requires BoE on final import receipt when policy is always", () => {
    expect(resolveBoeRequirement("FINAL", "IMPORT_GOODS", "ALWAYS", false)).toBe(true);
  });

  it("allows commercial before customs when policy permits", () => {
    expect(resolveBoeRequirement("COMMERCIAL", "IMPORT_GOODS", "ALWAYS", true)).toBe(false);
  });

  it("never requires BoE on GIT clearance", () => {
    expect(resolveBoeRequirement("GIT_CLEARANCE", "IMPORT_GOODS", "ALWAYS", false)).toBe(false);
  });
});

describe("grnReceiptStageLabel", () => {
  it("returns human labels for stages", () => {
    expect(grnReceiptStageLabel("GIT_CLEARANCE")).toBe("GIT clearance");
    expect(grnReceiptStageLabel("COMMERCIAL")).toBe("Commercial / staging");
  });
});

describe("resolveGrnReceiptContext", () => {
  it("derives staging GIT commercial receipt as PO-fulfilling", () => {
    const ctx = resolveGrnReceiptContext(stagingGitSettings, po, null, {
      receiptStage: "COMMERCIAL",
    });
    expect(ctx.receiptStage).toBe("COMMERCIAL");
    expect(ctx.isPoFulfilling).toBe(true);
    expect(ctx.stagingLocationId).toBe("staging-loc");
    expect(ctx.defaultDestinationLocationId).toBe("staging-loc");
    expect(ctx.showStageSelector).toBe(true);
    expect(ctx.allowedStages).toContain("GIT_CLEARANCE");
  });

  it("marks GIT clearance as non-PO-fulfilling", () => {
    const ctx = resolveGrnReceiptContext(stagingGitSettings, po, null, {
      receiptStage: "GIT_CLEARANCE",
      hasGitVoucher: true,
    });
    expect(ctx.isPoFulfilling).toBe(false);
    expect(ctx.requireBoe).toBe(false);
    expect(ctx.useAtomicGitClearance).toBe(true);
    expect(ctx.showGitLink).toBe(true);
  });

  it("uses shipment staging and destination when present", () => {
    const ctx = resolveGrnReceiptContext(stagingGitSettings, po, {
      id: "ship-1",
      staging_location_id: "ship-staging",
      ultimate_destination_location_id: "ship-dest",
    });
    expect(ctx.stagingLocationId).toBe("ship-staging");
    expect(ctx.defaultDestinationLocationId).toBe("ship-staging");
  });

  it("defaults to GIT clearance when a voucher is linked", () => {
    const ctx = resolveGrnReceiptContext(stagingGitSettings, po, null, {
      hasGitVoucher: true,
    });
    expect(ctx.receiptStage).toBe("GIT_CLEARANCE");
    expect(ctx.isPoFulfilling).toBe(false);
  });

  it("restricts stages for single-final-only strategy", () => {
    const ctx = resolveGrnReceiptContext(
      {
        ...DEFAULT_IMPORT_LOGISTICS_SETTINGS,
        import_receipt_document_strategy: "SINGLE_FINAL_ONLY",
      },
      po,
      null
    );
    expect(ctx.allowedStages).toEqual(["FINAL"]);
    expect(ctx.showStageSelector).toBe(false);
  });
});
