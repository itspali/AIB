import { describe, expect, it } from "vitest";
import { EDITOR_FIELD_SECTION } from "@/lib/products/item-editor/editor-shell-shared";
import { resolveEditorScrollSpyOffset } from "@/lib/products/item-editor/editor-shell-shared";

describe("item editor shell shared", () => {
  it("maps core form fields to editor sections", () => {
    expect(EDITOR_FIELD_SECTION.name).toBe("overview");
    expect(EDITOR_FIELD_SECTION.selling_price).toBe("salable");
    expect(EDITOR_FIELD_SECTION.purchase_price).toBe("purchasable");
    expect(EDITOR_FIELD_SECTION.custom_fields).toBe("custom_fields");
  });

  it("adds sticky nav height to scroll spy offset on full page", () => {
    expect(resolveEditorScrollSpyOffset(false, 40, false)).toBe(96 + 40 + 8);
    expect(resolveEditorScrollSpyOffset(true, 0, false)).toBe(20);
  });
});
