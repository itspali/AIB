import { describe, expect, it } from "vitest";
import { pathnameMatchesScope, resolveScopeFromPath } from "@/lib/search/scopes";

describe("module route scope", () => {
  it("resolves items module paths", () => {
    expect(resolveScopeFromPath("/items")).toBe("items");
    expect(resolveScopeFromPath("/items/categories")).toBe("categories");
    expect(resolveScopeFromPath("/items?id=abc")).toBe("items");
  });

  it("still resolves legacy inventory catalog paths", () => {
    expect(resolveScopeFromPath("/inventory/items")).toBe("items");
    expect(resolveScopeFromPath("/inventory/categories")).toBe("categories");
  });

  it("resolves inventory operations paths", () => {
    expect(resolveScopeFromPath("/inventory/stock")).toBe("stock");
    expect(resolveScopeFromPath("/inventory/transfers")).toBe("transfers");
    expect(resolveScopeFromPath("/inventory/transfers?id=abc")).toBe("transfers");
  });

  it("matches pathname to active module scope", () => {
    expect(pathnameMatchesScope("/items", "items")).toBe(true);
    expect(pathnameMatchesScope("/items/categories", "items")).toBe(false);
    expect(pathnameMatchesScope("/items/categories", "categories")).toBe(true);
  });

  it("prevents cross-module server action routing assumptions", () => {
    expect(pathnameMatchesScope("/items/categories", "items")).toBe(false);
    expect(pathnameMatchesScope("/items", "categories")).toBe(false);
  });
});
