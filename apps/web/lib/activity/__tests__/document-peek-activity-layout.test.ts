import { describe, expect, it } from "vitest";
import { resolveDocumentPeekActivityLayoutMode } from "@/lib/activity/document-peek-activity-layout";
import type { RightDrawerLayoutValue } from "@/components/ui/right-drawer";

function layout(widthVw: number, isPartialDrawer = true): RightDrawerLayoutValue {
  return { widthVw, isPartialDrawer };
}

describe("resolveDocumentPeekActivityLayoutMode", () => {
  it("uses stack on mobile regardless of drawer width", () => {
    expect(resolveDocumentPeekActivityLayoutMode(layout(80), true)).toBe("stack");
    expect(resolveDocumentPeekActivityLayoutMode(layout(100), true)).toBe("stack");
  });

  it("uses stack below 60vw on desktop", () => {
    expect(resolveDocumentPeekActivityLayoutMode(layout(40), false)).toBe("stack");
    expect(resolveDocumentPeekActivityLayoutMode(null, false)).toBe("stack");
  });

  it("uses rail between 60vw and 79vw on partial drawer", () => {
    expect(resolveDocumentPeekActivityLayoutMode(layout(60), false)).toBe("rail");
    expect(resolveDocumentPeekActivityLayoutMode(layout(79), false)).toBe("rail");
  });

  it("uses split at 80vw and full width", () => {
    expect(resolveDocumentPeekActivityLayoutMode(layout(80), false)).toBe("split");
    expect(resolveDocumentPeekActivityLayoutMode(layout(100), false)).toBe("split");
  });

  it("falls back to stack when drawer is not partial below split threshold", () => {
    expect(resolveDocumentPeekActivityLayoutMode(layout(60, false), false)).toBe("stack");
  });
});
