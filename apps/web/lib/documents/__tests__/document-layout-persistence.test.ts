import { describe, expect, it } from "vitest";
import {
  documentLayoutFromRow,
  serializeDocumentLayoutTemplate,
} from "@/lib/documents/document-layout-persistence";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  patchPoLayoutColumn,
} from "@/lib/documents/purchase-order-layout";

describe("document-layout-persistence", () => {
  it("round-trips layout through DB row shape", () => {
    const layout = patchPoLayoutColumn(DEFAULT_PO_SCREEN_LAYOUT, "supplier", {
      label: "Vendor",
      defaultVisible: true,
      labelTypography: { fontSize: "sm", fontWeight: "semibold" },
      valueTypography: { fontSize: "sm", fontWeight: "semibold" },
    });

    const row = serializeDocumentLayoutTemplate(layout);
    const restored = documentLayoutFromRow(row, "PURCHASE_ORDER", "SCREEN_GRID");

    expect(restored.columns.find((column) => column.id === "supplier")).toMatchObject({
      label: "Vendor",
      labelTypography: { fontSize: "sm", fontWeight: "semibold" },
      valueTypography: { fontSize: "sm", fontWeight: "semibold" },
    });
    expect(restored.lineColumnOrder).toEqual(layout.lineColumnOrder);
    expect(restored.headerFieldOrder).toEqual(layout.headerFieldOrder);
    expect(restored.imageDisplayMode).toBe(layout.imageDisplayMode);
  });

  it("migrates legacy typography when loading rows", () => {
    const row = serializeDocumentLayoutTemplate(
      patchPoLayoutColumn(DEFAULT_PO_SCREEN_LAYOUT, "supplier", {
        label: "Vendor",
        defaultVisible: true,
        typography: { fontSize: "sm", fontWeight: "semibold" },
      })
    );
    const restored = documentLayoutFromRow(row, "PURCHASE_ORDER", "SCREEN_GRID");

    expect(restored.columns.find((column) => column.id === "supplier")).toMatchObject({
      labelTypography: { fontSize: "sm", fontWeight: "semibold" },
      valueTypography: { fontSize: "sm", fontWeight: "semibold" },
    });
  });

  it("falls back to code defaults when row is missing", () => {
    const layout = documentLayoutFromRow(null, "PURCHASE_ORDER", "SCREEN_GRID");
    expect(layout.columns.find((column) => column.id === "item")?.label).toBe("Item");
  });
});
