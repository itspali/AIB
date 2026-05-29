import { describe, expect, it } from "vitest";
import { moduleNavItems } from "@/components/layout/module-nav";
import {
  getActiveModuleNavChild,
  isModuleNavChildActive,
  isModuleNavItemActive,
} from "@/lib/layout/module-nav-active";

const inventoryItem = moduleNavItems.find((item) => item.href === "/inventory/items")!;

describe("module-nav-active", () => {
  it("highlights Inventory on items, categories, and locations routes", () => {
    expect(isModuleNavItemActive(inventoryItem, "/inventory/items")).toBe(true);
    expect(isModuleNavItemActive(inventoryItem, "/inventory/categories")).toBe(true);
    expect(isModuleNavItemActive(inventoryItem, "/inventory/locations")).toBe(true);
    expect(isModuleNavItemActive(inventoryItem, "/dashboard")).toBe(false);
  });

  it("selects the longest matching inventory child", () => {
    expect(getActiveModuleNavChild(inventoryItem, "/inventory/items")?.label).toBe("Items");
    expect(getActiveModuleNavChild(inventoryItem, "/inventory/categories")?.label).toBe(
      "Categories"
    );
    expect(getActiveModuleNavChild(inventoryItem, "/inventory/locations/topology")?.label).toBe(
      "Locations"
    );
  });

  it("does not mark Items active on the categories route", () => {
    const items = inventoryItem.children!.find((child) => child.label === "Items")!;
    const categories = inventoryItem.children!.find((child) => child.label === "Categories")!;

    expect(isModuleNavChildActive(items, "/inventory/items", inventoryItem)).toBe(true);
    expect(isModuleNavChildActive(items, "/inventory/categories", inventoryItem)).toBe(false);
    expect(isModuleNavChildActive(categories, "/inventory/categories", inventoryItem)).toBe(true);
  });
});
