import { describe, expect, it } from "vitest";
import {
  buildModuleHref,
  parseModuleDrawerState,
  MODULE_DRAWER_ACTION_EDIT,
  MODULE_DRAWER_ACTION_NEW,
} from "@/lib/layout/module-drawer-url";

describe("parseModuleDrawerState", () => {
  it("parses peek, edit, and create surfaces", () => {
    expect(
      parseModuleDrawerState(new URLSearchParams("id=abc")).surface
    ).toBe("peek");
    expect(
      parseModuleDrawerState(new URLSearchParams("id=abc&variant=v1")).variantId
    ).toBe("v1");
    expect(
      parseModuleDrawerState(
        new URLSearchParams("id=abc&action=edit")
      ).surface
    ).toBe("edit");
    expect(
      parseModuleDrawerState(new URLSearchParams("action=new")).surface
    ).toBe("create");
  });

  it("canonicalizes legacy category and item params", () => {
    const legacyItem = parseModuleDrawerState(new URLSearchParams("item=legacy-id"));
    expect(legacyItem.recordId).toBe("legacy-id");
    expect(legacyItem.needsCanonicalize).toBe(true);

    const legacyCategory = parseModuleDrawerState(
      new URLSearchParams("selected=cat-id&create=1")
    );
    expect(legacyCategory.recordId).toBe("cat-id");
    expect(legacyCategory.action).toBe(MODULE_DRAWER_ACTION_NEW);
    expect(legacyCategory.needsCanonicalize).toBe(true);
  });
});

describe("buildModuleHref", () => {
  it("builds canonical query strings", () => {
    expect(buildModuleHref("/inventory/items", { recordId: "x" })).toBe(
      "/inventory/items?id=x"
    );
    expect(
      buildModuleHref("/inventory/items", { recordId: "x", variantId: "v1" })
    ).toBe("/inventory/items?id=x&variant=v1");
    expect(
      buildModuleHref("/inventory/items", {
        recordId: "x",
        action: MODULE_DRAWER_ACTION_EDIT,
      })
    ).toBe("/inventory/items?id=x&action=edit");
    expect(
      buildModuleHref("/inventory/items", { action: MODULE_DRAWER_ACTION_NEW })
    ).toBe("/inventory/items?action=new");
  });
});
