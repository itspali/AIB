import { describe, expect, it } from "vitest";
import {
  coerceProductListPrefs,
  getDefaultProductListPrefs,
  getMaxCardGridColumns,
  getOrderedVisibleColumns,
  PRODUCT_LIST_PREFS_VERSION,
  resolveCardGridColumns,
  resolveFrozenColumnCount,
  resolvePrefsOnMount,
  resolveProductListExpandVariants,
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
    expect(migrated.cardGridColumns).toEqual({
      mobile: "auto",
      tablet: "auto",
      desktop: "auto",
    });
    expect(migrated.cardLayout).toBe("v2");
    expect(getOrderedVisibleColumns(migrated, "table", "desktop")).toEqual([
      "name",
      "default_sku",
      "is_active",
    ]);
    expect(getOrderedVisibleColumns(migrated, "card", "desktop")).toEqual([
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
    expect(getOrderedVisibleColumns(migrated, "card", "mobile")).toEqual([
      "image",
      "name",
      "default_sku",
      "is_active",
    ]);
    expect(getOrderedVisibleColumns(migrated, "card", "tablet")).toEqual([
      "image",
      "name",
      "default_sku",
      "category_name",
      "is_active",
      "updated_at",
    ]);
  });

  it("migrates v2 nested prefs to v6 with card column prefs from legacy compact", () => {
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
    expect(migrated.prefsVersion).toBe(PRODUCT_LIST_PREFS_VERSION);
    expect(migrated.viewMode).toBe("card");
    expect(migrated.cardGridColumns.desktop).toBe("auto");
    expect(getOrderedVisibleColumns(migrated, "card", "tablet")).toEqual(["name", "default_sku"]);
  });

  it("preserves nested v6 card column prefs", () => {
    const defaults = getDefaultProductListPrefs();
    const custom = {
      ...defaults,
      columnPrefs: {
        ...defaults.columnPrefs,
        card: {
          ...defaults.columnPrefs.card,
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
    expect(getOrderedVisibleColumns(parsed, "card", "desktop")).toEqual([
      "name",
      "classification",
    ]);
    expect(parsed.cardGridColumns.desktop).toBe(4);
  });

  it("preserves column wrap mode overrides for text columns", () => {
    const defaults = getDefaultProductListPrefs();
    const custom = {
      ...defaults,
      columnPrefs: {
        ...defaults.columnPrefs,
        table: {
          ...defaults.columnPrefs.table,
          desktop: {
            ...defaults.columnPrefs.table.desktop,
            columnWrapModes: {
              description: "wrap",
              default_sku: "wrap",
            },
          },
        },
      },
    };

    const parsed = coerceProductListPrefs(custom);
    expect(parsed.columnPrefs.table.desktop.columnWrapModes).toEqual({
      description: "wrap",
    });
  });
});

describe("resolvePrefsOnMount", () => {
  it("prefers local prefs when clientRevision is newer", () => {
    const defaults = getDefaultProductListPrefs();
    const server = { ...defaults, viewMode: "table" as const, clientRevision: 1 };
    const local = { ...defaults, viewMode: "card" as const, clientRevision: 3 };

    const resolved = resolvePrefsOnMount(server, local);

    expect(resolved.viewMode).toBe("card");
    expect(resolved.clientRevision).toBe(3);
  });

  it("prefers server prefs when local revision is stale or absent", () => {
    const defaults = getDefaultProductListPrefs();
    const server = { ...defaults, viewMode: "table" as const, clientRevision: 5 };
    const staleLocal = { ...defaults, viewMode: "card" as const, clientRevision: 2 };

    expect(resolvePrefsOnMount(server, staleLocal).viewMode).toBe("table");
    expect(resolvePrefsOnMount(server, null).viewMode).toBe("table");
    expect(resolvePrefsOnMount(null, staleLocal).viewMode).toBe("card");
    expect(resolvePrefsOnMount(null, null).viewMode).toBe("table");
  });

  it("uses server when revisions are equal", () => {
    const defaults = getDefaultProductListPrefs();
    const server = { ...defaults, viewMode: "table" as const, clientRevision: 2 };
    const local = { ...defaults, viewMode: "card" as const, clientRevision: 2 };

    expect(resolvePrefsOnMount(server, local).viewMode).toBe("table");
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

describe("resolveProductListExpandVariants", () => {
  it("expands variants for table and card views", () => {
    expect(resolveProductListExpandVariants(true, "table")).toBe(true);
    expect(resolveProductListExpandVariants(true, "compact")).toBe(true);
    expect(resolveProductListExpandVariants(true, "card")).toBe(true);
    expect(resolveProductListExpandVariants(false, "table")).toBe(false);
  });
});

describe("resolveCardGridColumns", () => {
  it("clamps desktop preference on smaller devices", () => {
    const prefs = getDefaultProductListPrefs();
    prefs.cardGridColumns = { mobile: "auto", tablet: "auto", desktop: 6 };

    expect(resolveCardGridColumns(prefs, "desktop")).toBe(6);
    expect(resolveCardGridColumns(prefs, "tablet")).toBe(2);
    expect(resolveCardGridColumns(prefs, "mobile")).toBe(1);
  });

  it("resolves auto card columns from detected device class", () => {
    const prefs = getDefaultProductListPrefs();
    prefs.cardGridColumns = { mobile: "auto", tablet: "auto", desktop: "auto" };

    expect(resolveCardGridColumns(prefs, "desktop")).toBe(2);
    expect(resolveCardGridColumns(prefs, "tablet")).toBe(2);
    expect(resolveCardGridColumns(prefs, "mobile")).toBe(1);
  });

  it("clamps over-max stored values per device", () => {
    const prefs = coerceProductListPrefs({
      ...getDefaultProductListPrefs(),
      cardGridColumns: { mobile: 6, tablet: 6, desktop: 6 },
    });

    expect(prefs.cardGridColumns.mobile).toBe(2);
    expect(prefs.cardGridColumns.tablet).toBe(4);
    expect(prefs.cardGridColumns.desktop).toBe(6);
  });

  it("exposes per-device max card grid columns", () => {
    expect(getMaxCardGridColumns("mobile")).toBe(2);
    expect(getMaxCardGridColumns("tablet")).toBe(4);
    expect(getMaxCardGridColumns("desktop")).toBe(6);
  });

  it("defaults showVariants to false and coerces persisted true", () => {
    expect(getDefaultProductListPrefs().showVariants).toBe(false);
    expect(
      coerceProductListPrefs({
        ...getDefaultProductListPrefs(),
        showVariants: true,
      }).showVariants
    ).toBe(true);
  });

  it("preserves cardLayout when coerced", () => {
    expect(
      coerceProductListPrefs({
        ...getDefaultProductListPrefs(),
        cardLayout: "v2",
      }).cardLayout
    ).toBe("v2");
    expect(
      coerceProductListPrefs({
        ...getDefaultProductListPrefs(),
        cardLayout: "shop",
      }).cardLayout
    ).toBe("shop");
  });

  it("coerces unknown cardLayout to detail (v2)", () => {
    expect(
      coerceProductListPrefs({
        ...getDefaultProductListPrefs(),
        cardLayout: "unknown",
      }).cardLayout
    ).toBe("v2");
  });
});

describe("resolveFrozenColumnCount", () => {
  it("forces zero frozen columns on mobile", () => {
    const prefs = { ...getDefaultProductListPrefs(), frozenColumnCount: 2 as const };

    expect(resolveFrozenColumnCount(prefs, "mobile")).toBe(0);
    expect(resolveFrozenColumnCount(prefs, "tablet")).toBe(2);
    expect(resolveFrozenColumnCount(prefs, "desktop")).toBe(2);
  });

  it("resolves auto frozen columns from detected device class", () => {
    const prefs = { ...getDefaultProductListPrefs(), frozenColumnCount: "auto" as const };

    expect(resolveFrozenColumnCount(prefs, "mobile")).toBe(0);
    expect(resolveFrozenColumnCount(prefs, "tablet")).toBe(1);
    expect(resolveFrozenColumnCount(prefs, "desktop")).toBe(2);
  });
});
