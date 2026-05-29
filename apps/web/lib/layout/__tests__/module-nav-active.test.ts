import { describe, expect, it } from "vitest";
import { moduleNavItems } from "@/components/layout/module-nav";
import {
  getActiveModuleNavChild,
  isModuleNavChildActive,
  isModuleNavItemActive,
} from "@/lib/layout/module-nav-active";

const catalogItem = moduleNavItems.find((item) => item.href === "/items")!;

describe("module-nav-active", () => {
  it("highlights Product Catalog on products and categories routes", () => {
    expect(isModuleNavItemActive(catalogItem, "/items")).toBe(true);
    expect(isModuleNavItemActive(catalogItem, "/items/categories")).toBe(true);
    expect(isModuleNavItemActive(catalogItem, "/dashboard")).toBe(false);
  });

  it("selects the longest matching catalog child", () => {
    expect(getActiveModuleNavChild(catalogItem, "/items")?.label).toBe("Products");
    expect(getActiveModuleNavChild(catalogItem, "/items/categories")?.label).toBe("Categories");
  });

  it("does not mark Products active on the categories route", () => {
    const products = catalogItem.children!.find((child) => child.label === "Products")!;
    const categories = catalogItem.children!.find((child) => child.label === "Categories")!;

    expect(isModuleNavChildActive(products, "/items", catalogItem)).toBe(true);
    expect(isModuleNavChildActive(products, "/items/categories", catalogItem)).toBe(false);
    expect(isModuleNavChildActive(categories, "/items/categories", catalogItem)).toBe(true);
  });
});
