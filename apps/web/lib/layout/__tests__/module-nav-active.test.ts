import { describe, expect, it } from "vitest";
import { moduleNavItems } from "@/components/layout/module-nav";
import {
  getActiveModuleNavChild,
  getModuleNavEntryHref,
  isModuleNavChildActive,
  isModuleNavItemActive,
} from "@/lib/layout/module-nav-active";

const inventoryItem = moduleNavItems.find((item) => item.href === "/inventory")!;
const salesItem = moduleNavItems.find((item) => item.href === "/sales")!;
const procurementItem = moduleNavItems.find((item) => item.href === "/procurement")!;
const administrationItem = moduleNavItems.find((item) => item.href === "/settings")!;

describe("module-nav-active", () => {
  it("highlights Inventory on items and categories routes", () => {
    expect(isModuleNavItemActive(inventoryItem, "/inventory/items")).toBe(true);
    expect(isModuleNavItemActive(inventoryItem, "/inventory/categories")).toBe(true);
    expect(isModuleNavItemActive(inventoryItem, "/settings/locations")).toBe(false);
    expect(isModuleNavItemActive(inventoryItem, "/dashboard")).toBe(false);
  });

  it("highlights Administration on locations and uom routes", () => {
    expect(isModuleNavItemActive(administrationItem, "/settings/locations")).toBe(true);
    expect(isModuleNavItemActive(administrationItem, "/settings/uom")).toBe(true);
    expect(
      getActiveModuleNavChild(administrationItem, "/settings/locations/topology")?.label
    ).toBe("Locations");
  });

  it("selects the longest matching inventory child", () => {
    expect(getActiveModuleNavChild(inventoryItem, "/inventory/items")?.label).toBe("Items");
    expect(getActiveModuleNavChild(inventoryItem, "/inventory/categories")?.label).toBe(
      "Categories"
    );
  });

  it("does not mark Items active on the categories route", () => {
    const items = inventoryItem.children!.find((child) => child.label === "Items")!;
    const categories = inventoryItem.children!.find((child) => child.label === "Categories")!;

    expect(isModuleNavChildActive(items, "/inventory/items", inventoryItem)).toBe(true);
    expect(isModuleNavChildActive(items, "/inventory/categories", inventoryItem)).toBe(false);
    expect(isModuleNavChildActive(categories, "/inventory/categories", inventoryItem)).toBe(true);
  });

  it("resolves the default entry href for modules with sections", () => {
    expect(getModuleNavEntryHref(inventoryItem)).toBe("/inventory/items");
    expect(getModuleNavEntryHref(salesItem)).toBe("/sales/customers");
    expect(getModuleNavEntryHref(procurementItem)).toBe("/procurement/suppliers");
  });

  it("highlights Sales and Procurement on their section routes", () => {
    expect(isModuleNavItemActive(salesItem, "/sales/quotes")).toBe(true);
    expect(getActiveModuleNavChild(salesItem, "/sales/invoices")?.label).toBe("Invoices");
    expect(isModuleNavItemActive(procurementItem, "/procurement/bills")).toBe(true);
    expect(getActiveModuleNavChild(procurementItem, "/procurement/purchase-orders")?.label).toBe(
      "Purchase Orders"
    );
  });
});
