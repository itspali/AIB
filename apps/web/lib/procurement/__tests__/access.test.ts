import { describe, expect, it } from "vitest";
import { canEditPurchaseOrderDocument } from "@/lib/procurement/access";

describe("canEditPurchaseOrderDocument", () => {
  it("denies edit without permission", () => {
    expect(
      canEditPurchaseOrderDocument("DRAFT", {
        allowEditIssued: true,
        hasEditPermission: false,
      })
    ).toBe(false);
  });

  it("allows draft edit with permission", () => {
    expect(
      canEditPurchaseOrderDocument("DRAFT", {
        allowEditIssued: false,
        hasEditPermission: true,
      })
    ).toBe(true);
  });

  it("allows issued edit only when tenant setting is enabled", () => {
    expect(
      canEditPurchaseOrderDocument("ISSUED_ACTIVE", {
        allowEditIssued: true,
        hasEditPermission: true,
      })
    ).toBe(true);

    expect(
      canEditPurchaseOrderDocument("ISSUED_ACTIVE", {
        allowEditIssued: false,
        hasEditPermission: true,
      })
    ).toBe(false);
  });

  it("blocks partially fulfilled and terminal statuses", () => {
    expect(
      canEditPurchaseOrderDocument("PARTIALLY_FULFILLED", {
        allowEditIssued: true,
        hasEditPermission: true,
      })
    ).toBe(false);

    expect(
      canEditPurchaseOrderDocument("FULLY_COMPLETED", {
        allowEditIssued: true,
        hasEditPermission: true,
      })
    ).toBe(false);
  });
});
