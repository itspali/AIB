import { describe, expect, it } from "vitest";
import {
  documentFieldTypographyClassName,
  documentTypographyClassName,
  patchDocumentTypography,
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
    ).toBe("text-lg font-bold italic tabular-nums");
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

describe("documentFieldTypographyClassName", () => {
  it("applies defaults when column has no typography", () => {
    expect(documentFieldTypographyClassName(undefined, "text-sm")).toBe("text-sm");
  });
});
