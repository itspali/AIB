import { describe, expect, it } from "vitest";
import { filterRowsByFeedQuery } from "@/lib/layout/list-workspace/feed-filter";
import { mapEntityListRowToSplitFeed } from "@/lib/layout/list-workspace/split-feed-mappers";
import type { EntityListRow } from "@/lib/entities/types";

const sampleRow = (overrides: Partial<EntityListRow> = {}): EntityListRow =>
  ({
    id: "1",
    name: "Acme Corp",
    legal_name: null,
    code: "ACME",
    type: "COMPANY",
    party_nature: "BUSINESS",
    tax_treatment: "REGISTERED",
    tax_registration_number: null,
    customer_category_id: null,
    customer_category_name: null,
    supplier_category_id: null,
    supplier_category_name: null,
    credit_limit: "0",
    current_balance: "0",
    payment_terms_days: 0,
    company_email: "ops@acme.test",
    company_phone: null,
    is_active: true,
    created_at: "",
    updated_at: "",
    primary_contact_name: "Jane",
    primary_contact_email: "jane@acme.test",
    ...overrides,
  }) as EntityListRow;

describe("filterRowsByFeedQuery", () => {
  it("returns all rows when query is empty", () => {
    const rows = [sampleRow(), sampleRow({ id: "2", name: "Beta" })];
    expect(filterRowsByFeedQuery(rows, "", (row) => [row.name])).toHaveLength(2);
  });

  it("filters by searchable fields case-insensitively", () => {
    const rows = [
      sampleRow(),
      sampleRow({ id: "2", name: "Beta Industries", code: "BETA" }),
    ];
    const filtered = filterRowsByFeedQuery(rows, "acme", (row) => [row.name, row.code]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.name).toBe("Acme Corp");
  });
});

describe("mapEntityListRowToSplitFeed", () => {
  it("maps core card fields for split feed", () => {
    const card = mapEntityListRowToSplitFeed(sampleRow());
    expect(card).toMatchObject({
      id: "1",
      code: "ACME",
      title: "Acme Corp",
      trailing: "Active",
      inactive: false,
    });
  });
});
