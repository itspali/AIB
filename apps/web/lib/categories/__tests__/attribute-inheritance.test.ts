import { describe, expect, it } from "vitest";
import type { CategoryRow } from "@/lib/categories/types";
import {
  mergeAttributeTemplates,
  resolveEffectiveAttributeTemplates,
  resolveInheritedAttributeTemplates,
} from "@/lib/categories/tree";

const brand = { key: "brand", label: "Brand", type: "text" as const };
const size = { key: "size", label: "Size", type: "select" as const, options: ["S", "M"] };
const color = { key: "color", label: "Color", type: "text" as const };
const fit = { key: "fit", label: "Fit", type: "text" as const };

const ROWS: CategoryRow[] = [
  {
    id: "apparel",
    name: "Apparel",
    parent_id: null,
    is_active: true,
    attribute_templates: [brand],
    inherit_parent_attributes: true,
    default_variant_strategy: "SINGLE_SKU",
    qc_receipt_policy: "INHERIT",
    created_at: "",
    updated_at: "",
  },
  {
    id: "shirts",
    name: "Shirts",
    parent_id: "apparel",
    is_active: true,
    attribute_templates: [size],
    inherit_parent_attributes: true,
    default_variant_strategy: "MULTI_SKU",
    qc_receipt_policy: "INHERIT",
    created_at: "",
    updated_at: "",
  },
  {
    id: "standalone",
    name: "Standalone",
    parent_id: "apparel",
    is_active: true,
    attribute_templates: [color],
    inherit_parent_attributes: false,
    default_variant_strategy: "SINGLE_SKU",
    qc_receipt_policy: "INHERIT",
    created_at: "",
    updated_at: "",
  },
];

describe("mergeAttributeTemplates", () => {
  it("overrides earlier keys with later entries", () => {
    const merged = mergeAttributeTemplates(
      [{ key: "brand", label: "Brand", type: "text" }],
      [{ key: "brand", label: "Brand name", type: "text", required: true }]
    );
    expect(merged).toEqual([{ key: "brand", label: "Brand name", type: "text", required: true }]);
  });
});

describe("resolveEffectiveAttributeTemplates", () => {
  it("merges ancestor templates when inherit is enabled", () => {
    expect(resolveEffectiveAttributeTemplates("shirts", ROWS).map((entry) => entry.key)).toEqual([
      "brand",
      "size",
    ]);
  });

  it("returns only own templates when inherit is disabled", () => {
    expect(resolveEffectiveAttributeTemplates("standalone", ROWS).map((entry) => entry.key)).toEqual([
      "color",
    ]);
  });

  it("returns own templates for root categories", () => {
    expect(resolveEffectiveAttributeTemplates("apparel", ROWS).map((entry) => entry.key)).toEqual([
      "brand",
    ]);
  });

  it("does not overflow when parent links form a cycle", () => {
    const cyclic: CategoryRow[] = [
      {
        id: "a",
        name: "A",
        parent_id: "b",
        is_active: true,
        attribute_templates: [brand],
        inherit_parent_attributes: true,
        default_variant_strategy: "SINGLE_SKU",
        qc_receipt_policy: "INHERIT",
        created_at: "",
        updated_at: "",
      },
      {
        id: "b",
        name: "B",
        parent_id: "a",
        is_active: true,
        attribute_templates: [size],
        inherit_parent_attributes: true,
        default_variant_strategy: "SINGLE_SKU",
        qc_receipt_policy: "INHERIT",
        created_at: "",
        updated_at: "",
      },
    ];

    expect(() =>
      resolveEffectiveAttributeTemplates("a", cyclic).map((entry) => entry.key)
    ).not.toThrow();
    expect(resolveEffectiveAttributeTemplates("a", cyclic).map((entry) => entry.key)).toEqual([
      "size",
      "brand",
    ]);
  });
});

describe("resolveInheritedAttributeTemplates", () => {
  it("returns parent effective templates excluding own rows", () => {
    expect(resolveInheritedAttributeTemplates("shirts", ROWS).map((entry) => entry.key)).toEqual([
      "brand",
    ]);
  });

  it("returns empty when inherit is disabled", () => {
    expect(resolveInheritedAttributeTemplates("standalone", ROWS)).toEqual([]);
  });
});

describe("opt-out breaks the chain for descendants", () => {
  const rows: CategoryRow[] = [
    {
      ...ROWS[0],
      attribute_templates: [brand],
    },
    {
      id: "break",
      name: "Break",
      parent_id: "apparel",
      is_active: true,
      attribute_templates: [fit],
      inherit_parent_attributes: false,
      default_variant_strategy: "SINGLE_SKU",
      qc_receipt_policy: "INHERIT",
      created_at: "",
      updated_at: "",
    },
    {
      id: "child",
      name: "Child",
      parent_id: "break",
      is_active: true,
      attribute_templates: [color],
      inherit_parent_attributes: true,
      default_variant_strategy: "SINGLE_SKU",
      qc_receipt_policy: "INHERIT",
      created_at: "",
      updated_at: "",
    },
  ];

  it("child inherits only from effective parent, not skipped ancestors", () => {
    expect(resolveEffectiveAttributeTemplates("child", rows).map((entry) => entry.key)).toEqual([
      "fit",
      "color",
    ]);
  });
});
