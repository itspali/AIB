import { describe, expect, it } from "vitest";
import { SETTINGS_ROUTES } from "@/lib/settings/navigation";
import { moduleNavItems } from "@/components/layout/module-nav";
import {
  getActiveModuleNavChild,
  getModuleNavEntryHref,
  isModuleNavChildActive,
  isModuleNavItemActive,
} from "@/lib/layout/module-nav-active";

const itemsModule = moduleNavItems.find((item) => item.href === "/items")!;
const inventoryItem = moduleNavItems.find((item) => item.href === "/inventory")!;
const salesItem = moduleNavItems.find((item) => item.href === "/sales")!;
const fulfillmentItem = moduleNavItems.find((item) => item.href === "/fulfillment")!;
const procurementItem = moduleNavItems.find((item) => item.href === "/procurement")!;
const administrationItem = moduleNavItems.find((item) => item.href === "/settings")!;

describe("module-nav-active", () => {
  it("highlights Items on catalog and categories routes", () => {
    expect(isModuleNavItemActive(itemsModule, "/items")).toBe(true);
    expect(isModuleNavItemActive(itemsModule, "/items/categories")).toBe(true);
    expect(isModuleNavItemActive(itemsModule, "/inventory/stock")).toBe(false);
    expect(isModuleNavItemActive(itemsModule, "/dashboard")).toBe(false);
  });

  it("highlights Inventory on overview and operational routes", () => {
    expect(isModuleNavItemActive(inventoryItem, "/inventory")).toBe(true);
    expect(isModuleNavItemActive(inventoryItem, "/inventory/stock")).toBe(true);
    expect(isModuleNavItemActive(inventoryItem, "/inventory/transfers")).toBe(true);
    expect(isModuleNavItemActive(inventoryItem, "/items")).toBe(false);
  });

  it("highlights Administration on locations, document templates, and uom routes", () => {
    expect(isModuleNavItemActive(administrationItem, SETTINGS_ROUTES.workspaceLocations)).toBe(true);
    expect(isModuleNavItemActive(administrationItem, SETTINGS_ROUTES.presentationDocuments)).toBe(true);
    expect(isModuleNavItemActive(administrationItem, SETTINGS_ROUTES.catalogsUom)).toBe(true);
    expect(
      getActiveModuleNavChild(administrationItem, "/settings/presentation/documents/SALES_INVOICE")
        ?.label
    ).toBe("Document templates");
    expect(
      getActiveModuleNavChild(administrationItem, SETTINGS_ROUTES.workspaceLocationsTopology)?.label
    ).toBe("Locations");
  });

  it("selects the longest matching items child", () => {
    expect(getActiveModuleNavChild(itemsModule, "/items")?.label).toBe("Catalog");
    expect(getActiveModuleNavChild(itemsModule, "/items/categories")?.label).toBe("Categories");
  });

  it("does not mark Catalog active on the categories route", () => {
    const catalog = itemsModule.children!.find((child) => child.label === "Catalog")!;
    const categories = itemsModule.children!.find((child) => child.label === "Categories")!;

    expect(isModuleNavChildActive(catalog, "/items", itemsModule)).toBe(true);
    expect(isModuleNavChildActive(catalog, "/items/categories", itemsModule)).toBe(false);
    expect(isModuleNavChildActive(categories, "/items/categories", itemsModule)).toBe(true);
  });

  it("resolves the default entry href for modules with sections", () => {
    expect(getModuleNavEntryHref(itemsModule)).toBe("/items");
    expect(getModuleNavEntryHref(inventoryItem)).toBe("/inventory");
    expect(getModuleNavEntryHref(salesItem)).toBe("/sales");
    expect(getModuleNavEntryHref(fulfillmentItem)).toBe("/fulfillment");
    expect(getModuleNavEntryHref(procurementItem)).toBe("/procurement");
  });

  it("highlights Sales on customer and category routes", () => {
    expect(isModuleNavItemActive(salesItem, "/sales")).toBe(true);
    expect(isModuleNavItemActive(salesItem, "/sales/customers")).toBe(true);
    expect(isModuleNavItemActive(salesItem, "/sales/customers/categories")).toBe(true);
    expect(getActiveModuleNavChild(salesItem, "/sales/customers/categories")?.label).toBe(
      "Customer Categories"
    );
  });

  it("does not mark Customers active on the customer categories route", () => {
    const customers = salesItem.children!.find((child) => child.label === "Customers")!;
    const categories = salesItem.children!.find(
      (child) => child.label === "Customer Categories"
    )!;

    expect(isModuleNavChildActive(customers, "/sales/customers", salesItem)).toBe(true);
    expect(isModuleNavChildActive(customers, "/sales/customers/categories", salesItem)).toBe(
      false
    );
    expect(isModuleNavChildActive(categories, "/sales/customers/categories", salesItem)).toBe(true);
  });

  it("highlights Procurement on supplier and category routes", () => {
    expect(isModuleNavItemActive(procurementItem, "/procurement/suppliers")).toBe(true);
    expect(isModuleNavItemActive(procurementItem, "/procurement/suppliers/categories")).toBe(true);
    expect(getActiveModuleNavChild(procurementItem, "/procurement/suppliers/categories")?.label).toBe(
      "Supplier Categories"
    );
  });

  it("highlights Fulfillment on overview and shipment routes", () => {
    expect(isModuleNavItemActive(fulfillmentItem, "/fulfillment")).toBe(true);
    expect(isModuleNavItemActive(fulfillmentItem, "/fulfillment/shipping")).toBe(true);
    expect(getActiveModuleNavChild(fulfillmentItem, "/fulfillment/shipping")?.label).toBe(
      "Shipments"
    );
    expect(isModuleNavItemActive(fulfillmentItem, "/sales/orders")).toBe(false);
  });

  it("does not mark Overview active on the shipments route", () => {
    const overview = fulfillmentItem.children!.find((child) => child.label === "Overview")!;
    const shipments = fulfillmentItem.children!.find((child) => child.label === "Shipments")!;

    expect(isModuleNavChildActive(overview, "/fulfillment", fulfillmentItem)).toBe(true);
    expect(isModuleNavChildActive(overview, "/fulfillment/shipping", fulfillmentItem)).toBe(false);
    expect(isModuleNavChildActive(shipments, "/fulfillment/shipping", fulfillmentItem)).toBe(true);
  });

  it("highlights Sales and Procurement on their section routes", () => {
    expect(isModuleNavItemActive(salesItem, "/sales/quotes")).toBe(true);
    expect(getActiveModuleNavChild(salesItem, "/sales/invoices")?.label).toBe("Invoices");
    expect(isModuleNavItemActive(procurementItem, "/procurement/bills")).toBe(true);
    expect(getActiveModuleNavChild(procurementItem, "/procurement/purchase-orders")?.label).toBe(
      "Purchase Orders"
    );
    expect(getActiveModuleNavChild(procurementItem, "/procurement/goods-receipts")?.label).toBe(
      "Goods Receipts"
    );
  });
});
