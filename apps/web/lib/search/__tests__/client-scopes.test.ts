import { describe, expect, it } from "vitest";
import type { CategoryRow } from "@/lib/categories/types";
import type { EntityListRow } from "@/lib/entities/types";
import type { StockTransferRow } from "@/lib/inventory/transfers/types";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import {
  filterCategoriesByAst,
  filterEntitiesByAst,
  filterPurchaseOrdersByAst,
  filterPurchaseOrdersByResidual,
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

const ENTITY_ROWS: EntityListRow[] = [
  {
    id: "e1",
    name: "Acme Retail",
    legal_name: null,
    code: null,
    type: "CUSTOMER",
    party_nature: "ORGANIZATION",
    tax_treatment: "REGULAR_B2B",
    tax_registration_number: null,
    customer_category_id: "cat-retail",
    customer_category_name: "Retail",
    supplier_category_id: null,
    supplier_category_name: null,
    credit_limit: "0",
    current_balance: "0",
    payment_terms_days: 0,
    company_email: null,
    company_phone: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    primary_contact_name: null,
    primary_contact_email: null,
  },
  {
    id: "e2",
    name: "Jane Doe",
    legal_name: null,
    code: null,
    type: "CUSTOMER",
    party_nature: "INDIVIDUAL",
    tax_treatment: "UNREGISTERED_B2C",
    tax_registration_number: null,
    customer_category_id: "cat-wholesale",
    customer_category_name: "Wholesale",
    supplier_category_id: null,
    supplier_category_name: null,
    credit_limit: "0",
    current_balance: "0",
    payment_terms_days: 0,
    company_email: null,
    company_phone: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    primary_contact_name: "Jane Doe",
    primary_contact_email: null,
  },
];

describe("filterEntitiesByAst", () => {
  it("filters by party_nature", () => {
    const filtered = filterEntitiesByAst(ENTITY_ROWS, [
      {
        kind: "predicate",
        field: "party_nature",
        operator: "EQ",
        value: "INDIVIDUAL",
      },
    ]);

    expect(filtered.map((row) => row.id)).toEqual(["e2"]);
  });

  it("filters by customer_category_id", () => {
    const filtered = filterEntitiesByAst(ENTITY_ROWS, [
      {
        kind: "predicate",
        field: "customer_category_id",
        operator: "EQ",
        value: "cat-retail",
      },
    ]);

    expect(filtered.map((row) => row.id)).toEqual(["e1"]);
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

const PO_ROWS: PurchaseOrderRow[] = [
  {
    id: "po1",
    voucher_number: "PO-2026-0001",
    destination_location_id: "loc-a",
    destination_location_name: "Mumbai WH",
    destination_location_code: "MUM",
    supplier_id: "sup-1",
    supplier_name: "Acme Supplies",
    supplier_address: null,
    destination_address: null,
    document_status: "DRAFT",
    currency_code: "INR",
    payment_terms_days: 30,
    total_gross_amount: "100",
    total_tax_amount: "0",
    line_count: 1,
    total_net_amount: "100",
    prices_tax_inclusive: false,
    tax_supply_nature: "INTRASTATE",
    tax_mechanism: "FORWARD",
    supplier_tax_treatment: "REGULAR_B2B",
    supplier_country_code: "IN",
    incoterms_code: null,
    rcm_applicable: false,
    custom_fields: {},
    created_by: "u1",
    created_by_name: "Alex Operator",
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "po2",
    voucher_number: "PO-2026-0002",
    destination_location_id: "loc-b",
    destination_location_name: "Delhi WH",
    destination_location_code: "DEL",
    supplier_id: "sup-2",
    supplier_name: "Beta Vendor",
    supplier_address: null,
    destination_address: null,
    document_status: "ISSUED_ACTIVE",
    currency_code: "INR",
    payment_terms_days: 15,
    total_gross_amount: "250",
    total_tax_amount: "0",
    line_count: 2,
    total_net_amount: "250",
    prices_tax_inclusive: true,
    tax_supply_nature: "INTERSTATE",
    tax_mechanism: "FORWARD",
    supplier_tax_treatment: "REGULAR_B2B",
    supplier_country_code: "IN",
    incoterms_code: null,
    rcm_applicable: false,
    custom_fields: {},
    created_by: "u2",
    created_by_name: "Sam Buyer",
    created_at: "2026-06-02T00:00:00.000Z",
    updated_at: "2026-06-02T00:00:00.000Z",
  },
];

describe("filterPurchaseOrdersByAst", () => {
  it("matches voucher_number predicates", () => {
    const filtered = filterPurchaseOrdersByAst(PO_ROWS, [
      {
        kind: "predicate",
        field: "voucher_number",
        operator: "EQ",
        value: "PO-2026-0001",
      },
    ]);

    expect(filtered.map((row) => row.voucher_number)).toEqual(["PO-2026-0001"]);
  });

  it("matches document_status using labels and enum tokens", () => {
    const filtered = filterPurchaseOrdersByAst(PO_ROWS, [
      {
        kind: "predicate",
        field: "document_status",
        operator: "ILIKE",
        value: "issued",
      },
    ]);

    expect(filtered.map((row) => row.id)).toEqual(["po2"]);
  });
});

describe("filterPurchaseOrdersByResidual", () => {
  it("searches across PO, supplier, and location fields", () => {
    const filtered = filterPurchaseOrdersByResidual(PO_ROWS, "acme");
    expect(filtered.map((row) => row.id)).toEqual(["po1"]);
  });
});
