import { describe, expect, it } from "vitest";
import {
  effectiveEntityFieldKeys,
  resolveEffectiveEntityFields,
} from "@/lib/entity-categories/field-resolution";
import type { EntityCategoryRow } from "@/lib/entity-categories/types";
import type { EntityCustomFieldDefinition } from "@/lib/entities/custom-field-definitions";

const industry = { key: "industry", label: "Industry", type: "text" as const };
const tier = {
  key: "tier",
  label: "Tier",
  type: "select" as const,
  options: [
    { label: "Gold", code: "GOLD" },
    { label: "Silver", code: "SILV" },
  ],
  required: true,
};
const region = { key: "region", label: "Region", type: "text" as const };

const ROWS: EntityCategoryRow[] = [
  {
    id: "root",
    name: "Root",
    parent_id: null,
    is_active: true,
    attribute_templates: [industry],
    inherit_parent_attributes: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "child",
    name: "Child",
    parent_id: "root",
    is_active: true,
    attribute_templates: [tier],
    inherit_parent_attributes: true,
    created_at: "",
    updated_at: "",
  },
];

const orgDefinitions: EntityCustomFieldDefinition[] = [
  {
    key: "industry",
    label: "Org Industry Label",
    type: "text",
    help_text: "From org settings",
    source: "organization",
  },
  {
    key: "unused",
    label: "Unused org field",
    type: "text",
    source: "organization",
  },
];

describe("resolveEffectiveEntityFields", () => {
  it("merges inherited category templates with org metadata", () => {
    const fields = resolveEffectiveEntityFields("customer", "child", ROWS, orgDefinitions);

    expect(fields.map((field) => field.key)).toEqual(["industry", "tier"]);
    expect(fields[0]).toMatchObject({
      key: "industry",
      label: "Industry",
      help_text: "From org settings",
      source: "organization",
    });
    expect(fields[1]).toMatchObject({
      key: "tier",
      label: "Tier",
      type: "select",
      required: true,
      options: ["Gold", "Silver"],
    });
  });

  it("returns empty when category id is missing", () => {
    expect(resolveEffectiveEntityFields("customer", null, ROWS, orgDefinitions)).toEqual([]);
  });

  it("excludes org-only fields not present in category templates", () => {
    const fields = resolveEffectiveEntityFields("customer", "root", ROWS, orgDefinitions);
    expect(fields.some((field) => field.key === "unused")).toBe(false);
  });
});

describe("effectiveEntityFieldKeys", () => {
  it("returns normalized keys from effective templates", () => {
    expect(effectiveEntityFieldKeys("customer", "child", ROWS)).toEqual(["industry", "tier"]);
  });

  it("returns empty when category id is missing", () => {
    expect(effectiveEntityFieldKeys("customer", null, ROWS)).toEqual([]);
  });
});
