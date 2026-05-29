import { describe, expect, it } from "vitest";
import {
  coerceProductListPrefs,
  getDefaultProductListPrefs,
  getOrderedVisibleColumns,
  PRODUCT_LIST_PREFS_VERSION,
  resolveCardGridColumns,
} from "@/lib/products/list-prefs";
import { resolveVisibleColumns } from "@/lib/products/resolve-list-columns";

describe("product list prefs migration", () => {
  it("migrates legacy flat column prefs into nested v3 contexts", () => {
    const legacy = {
      viewMode: "table",
      columnOrder: ["name", "default_sku", "category_name", "is_active"],
      visibleColumns: ["name", "default_sku", "is_active"],
      sortField: "name",
      sortDirection: "asc",
    };

    const migrated = coerceProductListPrefs(legacy);

    expect(migrated.prefsVersion).toBe(PRODUCT_LIST_PREFS_VERSION);
    expect(migrated.cardGridColumns).toEqual({ mobile: 1, tablet: 2, desktop: 2 });
    expect(getOrderedVisibleColumns(migrated, "table", "desktop")).toEqual([
      "name",
      "default_sku",
      "is_active",
    ]);
    expect(getOrderedVisibleColumns(migrated, "compact", "desktop")).toEqual([
      "name",
      "default_sku",
      "is_active",
    ]);
    expect(getOrderedVisibleColumns(migrated, "table", "mobile")).toEqual([
      "image",
      "name",
      "default_sku",
      "category_name",
      "is_active",
      "updated_at",
    ]);
    expect(getOrderedVisibleColumns(migrated, "compact", "mobile")).toEqual([
      "image",
      "name",
      "default_sku",
      "is_active",
    ]);
    expect(getOrderedVisibleColumns(migrated, "compact", "tablet")).toEqual([
      "image",
      "name",
      "default_sku",
      "category_name",
      "is_active",
      "updated_at",
    ]);
  });

  it("migrates v2 nested prefs to v3 with tablet slice and card grid columns", () => {
    const v2 = {
      prefsVersion: 2,
      viewMode: "compact",
      sortField: "name",
      sortDirection: "asc",
      frozenColumnCount: 0,
      columnPrefs: {
        table: {
          mobile: { columnOrder: ["name"], visibleColumns: ["name"] },
          desktop: { columnOrder: ["name", "default_sku"], visibleColumns: ["name", "default_sku"] },
        },
        compact: {
          mobile: { columnOrder: ["name"], visibleColumns: ["name"] },
          desktop: { columnOrder: ["name", "default_sku"], visibleColumns: ["name", "default_sku"] },
        },
      },
    };

    const migrated = coerceProductListPrefs(v2);
    expect(migrated.prefsVersion).toBe(3);
    expect(migrated.cardGridColumns.desktop).toBe(2);
    expect(getOrderedVisibleColumns(migrated, "compact", "tablet")).toEqual(["name", "default_sku"]);
  });

  it("preserves nested v3 column prefs", () => {
    const defaults = getDefaultProductListPrefs();
    const custom = {
      ...defaults,
      columnPrefs: {
        ...defaults.columnPrefs,
        compact: {
          ...defaults.columnPrefs.compact,
          desktop: {
            columnOrder: ["name", "default_sku", "classification"],
            visibleColumns: ["name", "classification"],
          },
        },
      },
      cardGridColumns: {
        mobile: 1,
        tablet: 2,
        desktop: 4,
      },
    };

    const parsed = coerceProductListPrefs(custom);
    expect(getOrderedVisibleColumns(parsed, "compact", "desktop")).toEqual([
      "name",
      "classification",
    ]);
    expect(parsed.cardGridColumns.desktop).toBe(4);
  });
});

describe("resolveVisibleColumns", () => {
  it("picks the correct slice and filters by permissions", () => {
    const prefs = getDefaultProductListPrefs();
    const staffAllowed = ["image", "name", "default_sku", "category_name", "is_active"];

    const visible = resolveVisibleColumns({
      prefs,
      viewMode: "table",
      deviceClass: "mobile",
      allowedFields: staffAllowed,
    });

    expect(visible).toEqual([
      "image",
      "name",
      "default_sku",
      "category_name",
      "is_active",
    ]);
    expect(visible).not.toContain("purchase_price");
    expect(visible).not.toContain("updated_at");
  });
});

describe("resolveCardGridColumns", () => {
  it("clamps desktop preference on smaller devices", () => {
    const prefs = getDefaultProductListPrefs();
    prefs.cardGridColumns = { mobile: 1, tablet: 2, desktop: 4 };

    expect(resolveCardGridColumns(prefs, "desktop")).toBe(4);
    expect(resolveCardGridColumns(prefs, "tablet")).toBe(2);
    expect(resolveCardGridColumns(prefs, "mobile")).toBe(1);
  });

  it("clamps over-max stored values per device", () => {
    const prefs = coerceProductListPrefs({
      ...getDefaultProductListPrefs(),
      cardGridColumns: { mobile: 4, tablet: 4, desktop: 4 },
    });

    expect(prefs.cardGridColumns.mobile).toBe(1);
    expect(prefs.cardGridColumns.tablet).toBe(2);
    expect(prefs.cardGridColumns.desktop).toBe(4);
  });
});
