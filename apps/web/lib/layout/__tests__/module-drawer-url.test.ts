import { describe, expect, it } from "vitest";
import {
  buildModuleHref,
  parseModuleDrawerState,
  parseModuleDrawerStateFromHref,
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
    expect(buildModuleHref("/items", { recordId: "x" })).toBe(
      "/items?id=x"
    );
    expect(
      buildModuleHref("/items", { recordId: "x", variantId: "v1" })
    ).toBe("/items?id=x&variant=v1");
    expect(
      buildModuleHref("/items", {
        recordId: "x",
        action: MODULE_DRAWER_ACTION_EDIT,
      })
    ).toBe("/items?id=x&action=edit");
    expect(
      buildModuleHref("/items", { action: MODULE_DRAWER_ACTION_NEW })
    ).toBe("/items?action=new");
    expect(
      buildModuleHref("/items", {
        recordId: "x",
        panel: "variants",
      })
    ).toBe("/items?id=x&panel=variants");
  });
});

describe("parseModuleDrawerStateFromHref", () => {
  it("parses drawer state from a module href", () => {
    const state = parseModuleDrawerStateFromHref(
      "/items?id=x&variant=v1&action=edit"
    );
    expect(state.recordId).toBe("x");
    expect(state.variantId).toBe("v1");
    expect(state.surface).toBe("edit");
  });
});
