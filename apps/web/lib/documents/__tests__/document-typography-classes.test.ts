import { describe, expect, it } from "vitest";
import {
  documentFieldLabelTypographyClassName,
  documentFieldValueTypographyClassName,
  documentTypographyClassName,
  documentTypographyInlineStyle,
  documentTypographyStyleAttr,
  normalizeDocumentColumnTypography,
  patchColumnTypographyRole,
  patchDocumentTypography,
  resolveColumnTypography,
} from "@/lib/documents/document-typography-classes";

describe("documentTypographyClassName", () => {
  it("returns base classes when typography is unset", () => {
    expect(documentTypographyClassName(undefined, "text-sm")).toBe("text-sm");
  });

  it("maps typography prefs to tailwind classes", () => {
    expect(
      documentTypographyClassName(
        { fontSize: "lg", fontWeight: "bold", fontStyle: "italic" },
        "tabular-nums"
      )
    ).toBe("tabular-nums text-lg font-bold italic");
  });

  it("lets column typography override default font weight", () => {
    expect(
      documentTypographyClassName({ fontWeight: "bold" }, "text-sm font-medium tabular-nums")
    ).toBe("text-sm tabular-nums font-bold");
  });
});

describe("patchDocumentTypography", () => {
  it("clears typography when all keys reset to default", () => {
    expect(
      patchDocumentTypography({ fontSize: "sm", fontWeight: "bold" }, "fontSize", "__default__")
    ).toEqual({ fontWeight: "bold" });
  });

  it("merges typography updates", () => {
    expect(patchDocumentTypography(undefined, "fontSize", "lg")).toEqual({ fontSize: "lg" });
  });
});

describe("split column typography", () => {
  it("resolves label and value typography independently", () => {
    const column = {
      labelTypography: { fontWeight: "bold" },
      valueTypography: { fontStyle: "italic" },
    };
    expect(resolveColumnTypography(column, "label")).toEqual({ fontWeight: "bold" });
    expect(resolveColumnTypography(column, "value")).toEqual({ fontStyle: "italic" });
  });

  it("falls back to legacy typography when split prefs are unset", () => {
    const column = { typography: { fontSize: "sm" } };
    expect(resolveColumnTypography(column, "label")).toEqual({ fontSize: "sm" });
    expect(resolveColumnTypography(column, "value")).toEqual({ fontSize: "sm" });
  });

  it("migrates legacy typography to split prefs", () => {
    expect(
      normalizeDocumentColumnTypography({
        id: "supplier",
        label: "Supplier",
        defaultVisible: true,
        typography: { fontWeight: "semibold" },
      })
    ).toEqual({
      id: "supplier",
      label: "Supplier",
      defaultVisible: true,
      labelTypography: { fontWeight: "semibold" },
      valueTypography: { fontWeight: "semibold" },
    });
  });

  it("patches role-specific typography", () => {
    expect(
      patchColumnTypographyRole(
        { id: "item", label: "Item", defaultVisible: true },
        "label",
        "fontWeight",
        "bold"
      )
    ).toEqual({ labelTypography: { fontWeight: "bold" }, typography: undefined });
  });
});

describe("documentFieldTypographyClassName helpers", () => {
  it("applies label and value typography separately", () => {
    const column = {
      labelTypography: { fontWeight: "bold" },
      valueTypography: { fontStyle: "italic" },
    };
    expect(documentFieldLabelTypographyClassName(column, "text-sm")).toBe("text-sm font-bold");
    expect(documentFieldValueTypographyClassName(column, "text-sm")).toBe("text-sm italic");
  });
});

describe("documentTypographyInlineStyle", () => {
  it("maps typography prefs to inline css", () => {
    expect(
      documentTypographyInlineStyle({ fontSize: "lg", fontWeight: "bold", fontStyle: "italic" })
    ).toBe("font-size:14px;font-weight:700;font-style:italic");
  });

  it("returns empty style attr when typography is unset", () => {
    expect(documentTypographyStyleAttr(undefined)).toBe("");
    expect(documentTypographyStyleAttr({ fontWeight: "bold" })).toBe(' style="font-weight:700"');
  });
});
