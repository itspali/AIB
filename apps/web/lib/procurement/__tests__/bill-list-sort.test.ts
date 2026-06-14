import { describe, expect, it } from "vitest";
import { sortPurchaseBillListRows } from "@/lib/procurement/bills/list-sort";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";

function bill(partial: Partial<PurchaseBillRow> & Pick<PurchaseBillRow, "id">): PurchaseBillRow {
  return {
    invoice_number_vendor: "INV-001",
    system_voucher_number: "BILL-001",
    supplier_id: "sup-1",
    supplier_name: "Acme Supplies",
    purchase_order_id: "po-1",
    purchase_order_number: "PO-001",
    tax_treatment: "REGISTERED",
    tax_supply_nature: "GOODS",
    tax_mechanism: "FORWARD",
    rcm_applicable: false,
    total_gross_amount: "100",
    total_tax_amount: "18",
    total_liability_amount: "118",
    match_status: "MATCHED",
    is_paid: false,
    created_at: "2026-01-15T10:00:00.000Z",
    ...partial,
  };
}

describe("sortPurchaseBillListRows", () => {
  it("sorts by supplier name ascending", () => {
    const rows = [
      bill({ id: "1", supplier_name: "Zeta Corp" }),
      bill({ id: "2", supplier_name: "Alpha Ltd" }),
    ];
    const sorted = sortPurchaseBillListRows(rows, "supplier", "asc");
    expect(sorted.map((row) => row.supplier_name)).toEqual(["Alpha Ltd", "Zeta Corp"]);
  });

  it("sorts amount due descending", () => {
    const rows = [
      bill({ id: "1", total_liability_amount: "50" }),
      bill({ id: "2", total_liability_amount: "500" }),
    ];
    const sorted = sortPurchaseBillListRows(rows, "liability", "desc");
    expect(sorted.map((row) => row.total_liability_amount)).toEqual(["500", "50"]);
  });

  it("sorts created date newest first by default direction", () => {
    const rows = [
      bill({ id: "1", created_at: "2026-01-01T00:00:00.000Z" }),
      bill({ id: "2", created_at: "2026-06-01T00:00:00.000Z" }),
    ];
    const sorted = sortPurchaseBillListRows(rows, "created", "desc");
    expect(sorted.map((row) => row.id)).toEqual(["2", "1"]);
  });
});
