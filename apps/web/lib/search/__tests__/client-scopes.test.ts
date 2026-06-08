import { describe, expect, it } from "vitest";
import type { CategoryRow } from "@/lib/categories/types";
import type { StockTransferRow } from "@/lib/inventory/transfers/types";
import {
  filterCategoriesByAst,
  filterTransfersByAst,
  filterTransfersByResidual,
} from "@/lib/search/executor/client-scopes";

const ROWS: CategoryRow[] = [
  {
    id: "1",
    name: "Electronics",
    parent_id: null,
    is_active: true,
    attribute_templates: [],
    inherit_parent_attributes: true,
    default_variant_strategy: "SINGLE_SKU",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "2",
    name: "Books",
    parent_id: null,
    is_active: true,
    attribute_templates: [],
    inherit_parent_attributes: true,
    default_variant_strategy: "SINGLE_SKU",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

describe("filterCategoriesByAst", () => {
  it("matches category_name predicates against row.name", () => {
    const filtered = filterCategoriesByAst(ROWS, [
      {
        kind: "predicate",
        field: "category_name",
        operator: "EQ",
        value: "Electronics",
      },
    ]);

    expect(filtered.map((row) => row.name)).toEqual(["Electronics"]);
  });

  it("supports ILIKE contains on category_name", () => {
    const filtered = filterCategoriesByAst(ROWS, [
      {
        kind: "predicate",
        field: "category_name",
        operator: "ILIKE",
        value: "book",
      },
    ]);

    expect(filtered.map((row) => row.name)).toEqual(["Books"]);
  });
});

const TRANSFER_ROWS: StockTransferRow[] = [
  {
    id: "t1",
    transfer_number: "ST-2026-0001",
    source_location_id: "loc-a",
    source_location_name: "Mumbai WH",
    source_location_code: "MUM",
    destination_location_id: "loc-b",
    destination_location_name: "Delhi WH",
    destination_location_code: "DEL",
    current_status: "DISPATCHED_IN_TRANSIT",
    line_count: 2,
    inter_company_freight_cost: "0",
    loading_overhead_cost: "0",
    unloading_overhead_cost: "0",
    dispatched_at: "2026-06-01T00:00:00.000Z",
    received_at: null,
    created_at: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "t2",
    transfer_number: "ST-2026-0002",
    source_location_id: "loc-b",
    source_location_name: "Delhi WH",
    source_location_code: "DEL",
    destination_location_id: "loc-a",
    destination_location_name: "Mumbai WH",
    destination_location_code: "MUM",
    current_status: "DRAFT",
    line_count: 1,
    inter_company_freight_cost: "0",
    loading_overhead_cost: "0",
    unloading_overhead_cost: "0",
    dispatched_at: null,
    received_at: null,
    created_at: "2026-06-02T00:00:00.000Z",
  },
];

describe("filterTransfersByAst", () => {
  it("matches transfer_number predicates", () => {
    const filtered = filterTransfersByAst(TRANSFER_ROWS, [
      {
        kind: "predicate",
        field: "transfer_number",
        operator: "EQ",
        value: "ST-2026-0001",
      },
    ]);

    expect(filtered.map((row) => row.transfer_number)).toEqual(["ST-2026-0001"]);
  });

  it("matches current_status using labels and enum tokens", () => {
    const filtered = filterTransfersByAst(TRANSFER_ROWS, [
      {
        kind: "predicate",
        field: "current_status",
        operator: "ILIKE",
        value: "in transit",
      },
    ]);

    expect(filtered.map((row) => row.id)).toEqual(["t1"]);
  });
});

describe("filterTransfersByResidual", () => {
  it("searches across document and location fields", () => {
    const filtered = filterTransfersByResidual(TRANSFER_ROWS, "delhi");
    expect(filtered.map((row) => row.id).sort()).toEqual(["t1", "t2"]);
  });
});
