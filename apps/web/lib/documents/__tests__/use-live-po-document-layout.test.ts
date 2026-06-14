import { describe, expect, it } from "vitest";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  normalizePoLayoutTemplate,
  patchPoLayoutColumn,
} from "@/lib/documents/purchase-order-layout";
import {
  clearPoDocumentLayoutCacheForTests,
  needsLocationLayoutFetch,
  resolveLayoutForDocumentLocation,
  seedPoDocumentLayoutCacheForTests,
} from "@/lib/documents/po-document-layout-cache";

describe("po document layout cache", () => {
  it("uses tenant default when no location override is cached", () => {
    clearPoDocumentLayoutCacheForTests();
    const layout = resolveLayoutForDocumentLocation(DEFAULT_PO_SCREEN_LAYOUT, "loc-1");
    expect(layout).toEqual(normalizePoLayoutTemplate(DEFAULT_PO_SCREEN_LAYOUT));
  });

  it("uses cached location layout when available", () => {
    clearPoDocumentLayoutCacheForTests();
    const locationLayout = patchPoLayoutColumn(DEFAULT_PO_SCREEN_LAYOUT, "sku", {
      defaultVisible: true,
    });
    seedPoDocumentLayoutCacheForTests("loc-1", locationLayout);

    const layout = resolveLayoutForDocumentLocation(DEFAULT_PO_SCREEN_LAYOUT, "loc-1");
    expect(layout).toEqual(normalizePoLayoutTemplate(locationLayout));
    expect(needsLocationLayoutFetch(true, "loc-1")).toBe(false);
  });

  it("needs fetch when refresh is on and location layout is not cached", () => {
    clearPoDocumentLayoutCacheForTests();
    expect(needsLocationLayoutFetch(true, "loc-1")).toBe(true);
    expect(needsLocationLayoutFetch(true, null)).toBe(false);
    expect(needsLocationLayoutFetch(false, "loc-1")).toBe(false);
  });
});
