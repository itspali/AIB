import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildDocumentListPage,
  resolveDocumentListPaging,
  type DocumentListFetchOptions,
  type DocumentListPage,
} from "@/lib/documents/list-page";
import type {
  LinkedGoodsReceiptSummary,
  PurchaseBillLineRow,
  PurchaseBillRow,
} from "@/lib/procurement/bills/types";
import type { PoTaxSupplyNature } from "@/lib/procurement/purchase-orders/po-tax-supply";
import { isPoTaxSupplyNature } from "@/lib/procurement/purchase-orders/po-tax-supply";
import type { GstTaxMechanism } from "@/lib/tax/gst-supply-context";

function formatDecimal(value: number | string | null | undefined): string {
  if (value == null || value === "") return "0";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "0";
}

export type PurchaseBillsFetchOptions = DocumentListFetchOptions;

export async function fetchPurchaseBillsPage(
  supabase: SupabaseClient,
  tenantId: string,
  options?: PurchaseBillsFetchOptions
): Promise<DocumentListPage<PurchaseBillRow>> {
  const { offset, limit } = resolveDocumentListPaging(options);

  const { data, error, count } = await supabase
    .from("purchase_invoices")
    .select(
      `id, invoice_number_vendor, system_voucher_number, supplier_id, purchase_order_id,
       tax_treatment, tax_supply_nature, tax_mechanism, rcm_applicable,
       total_gross_amount, total_tax_amount, total_liability_amount, match_status, document_status, is_paid, created_at,
       supplier:entities!purchase_invoices_supplier_tenant_fk (name),
       purchase_order:purchase_orders!purchase_invoices_po_tenant_fk (voucher_number)`,
      { count: "exact" }
    )
    .eq("tenant_id", tenantId)
    .eq("document_status", "ACTIVE")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((row) => {
    const supplier = Array.isArray(row.supplier) ? row.supplier[0] : row.supplier;
    const purchaseOrder = Array.isArray(row.purchase_order)
      ? row.purchase_order[0]
      : row.purchase_order;
    const mechanism = String(row.tax_mechanism ?? "FORWARD").toUpperCase() as GstTaxMechanism;
    const supplyNature = isPoTaxSupplyNature(String(row.tax_supply_nature ?? ""))
      ? (row.tax_supply_nature as PoTaxSupplyNature)
      : null;

    return {
      id: row.id as string,
      invoice_number_vendor: row.invoice_number_vendor as string,
      system_voucher_number: row.system_voucher_number as string,
      supplier_id: row.supplier_id as string,
      supplier_name: (supplier?.name as string) ?? "",
      purchase_order_id: (row.purchase_order_id as string | null) ?? null,
      purchase_order_number: (purchaseOrder?.voucher_number as string | null) ?? null,
      tax_treatment: row.tax_treatment as PurchaseBillRow["tax_treatment"],
      tax_supply_nature: supplyNature,
      tax_mechanism: mechanism,
      rcm_applicable: row.rcm_applicable === true,
      total_gross_amount: formatDecimal(row.total_gross_amount),
      total_tax_amount: formatDecimal(row.total_tax_amount),
      total_liability_amount: formatDecimal(row.total_liability_amount),
      match_status: (row.match_status as string | null) ?? "MATCHED",
      document_status: (row.document_status as string | null) ?? "ACTIVE",
      is_paid: row.is_paid === true,
      created_at: row.created_at as string,
    };
  });

  return buildDocumentListPage(rows, count ?? rows.length, offset, limit);
}

export async function fetchPurchaseBills(
  supabase: SupabaseClient,
  tenantId: string,
  options?: PurchaseBillsFetchOptions
): Promise<PurchaseBillRow[]> {
  const page = await fetchPurchaseBillsPage(supabase, tenantId, options);
  return page.rows;
}

export async function fetchPurchaseBillById(
  supabase: SupabaseClient,
  tenantId: string,
  purchaseInvoiceId: string
): Promise<PurchaseBillRow | null> {
  const { data, error } = await supabase
    .from("purchase_invoices")
    .select(
      `
      id, invoice_number_vendor, system_voucher_number, supplier_id, purchase_order_id,
      billing_location_id,
      tax_treatment, tax_supply_nature, tax_mechanism, rcm_applicable,
      total_gross_amount, total_tax_amount, total_liability_amount, match_status, document_status, is_paid, created_at,
      supplier:entities!purchase_invoices_supplier_tenant_fk (name),
      purchase_order:purchase_orders!purchase_invoices_po_tenant_fk (voucher_number),
      purchase_invoice_items (
        id, item_id, variant_id, purchase_order_item_id,
        quantity_billed, unit_price_billed, line_tax_computed, reverse_charge,
        items!purchase_invoice_items_item_tenant_fk (name),
        item_variants!purchase_invoice_items_variant_tenant_fk (sku)
      ),
      purchase_invoice_receipts (
        goods_receipt_id,
        goods_receipt:goods_receipts (id, voucher_number)
      )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("id", purchaseInvoiceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const supplier = Array.isArray(data.supplier) ? data.supplier[0] : data.supplier;
  const purchaseOrder = Array.isArray(data.purchase_order)
    ? data.purchase_order[0]
    : data.purchase_order;
  const mechanism = String(data.tax_mechanism ?? "FORWARD").toUpperCase() as PurchaseBillRow["tax_mechanism"];
  const supplyNature = isPoTaxSupplyNature(String(data.tax_supply_nature ?? ""))
    ? (data.tax_supply_nature as PoTaxSupplyNature)
    : null;

  const lines: PurchaseBillLineRow[] = (data.purchase_invoice_items ?? []).map((row) => {
    const typed = row as {
      id: string;
      item_id: string;
      variant_id: string | null;
      purchase_order_item_id: string | null;
      quantity_billed: number | string;
      unit_price_billed: number | string;
      line_tax_computed: number | string;
      reverse_charge: boolean;
      items: { name: string } | { name: string }[] | null;
      item_variants: { sku: string } | { sku: string }[] | null;
    };
    const item = Array.isArray(typed.items) ? typed.items[0] : typed.items;
    const variant = Array.isArray(typed.item_variants) ? typed.item_variants[0] : typed.item_variants;
    return {
      id: typed.id,
      item_id: typed.item_id,
      variant_id: typed.variant_id,
      purchase_order_item_id: typed.purchase_order_item_id,
      item_name: item?.name ?? "",
      variant_sku: variant?.sku ?? "",
      quantity_billed: formatDecimal(typed.quantity_billed),
      unit_price_billed: formatDecimal(typed.unit_price_billed),
      line_tax_computed: formatDecimal(typed.line_tax_computed),
      reverse_charge: typed.reverse_charge === true,
    };
  });

  const poItemIds = lines
    .map((line) => line.purchase_order_item_id)
    .filter((id): id is string => Boolean(id));
  if (poItemIds.length > 0) {
    const { data: poItems } = await supabase
      .from("purchase_order_items")
      .select("id, unit_price_contractual")
      .eq("tenant_id", tenantId)
      .in("id", poItemIds);
    const poRateById = new Map(
      (poItems ?? []).map((row) => [
        row.id as string,
        formatDecimal(row.unit_price_contractual as number | string),
      ])
    );
    for (const line of lines) {
      if (line.purchase_order_item_id) {
        line.po_unit_price = poRateById.get(line.purchase_order_item_id) ?? null;
      }
    }
  }

  const linked_goods_receipts: LinkedGoodsReceiptSummary[] = (data.purchase_invoice_receipts ?? [])
    .map((link) => {
      const typed = link as {
        goods_receipt_id: string;
        goods_receipt:
          | { id: string; voucher_number: string }
          | { id: string; voucher_number: string }[]
          | null;
      };
      const grn = Array.isArray(typed.goods_receipt) ? typed.goods_receipt[0] : typed.goods_receipt;
      if (!grn) return null;
      return { id: grn.id, voucher_number: grn.voucher_number };
    })
    .filter((row): row is LinkedGoodsReceiptSummary => row !== null);


  return {
    id: data.id as string,
    invoice_number_vendor: data.invoice_number_vendor as string,
    system_voucher_number: data.system_voucher_number as string,
    supplier_id: data.supplier_id as string,
    supplier_name: (supplier?.name as string) ?? "",
    billing_location_id: (data.billing_location_id as string | null) ?? null,
    purchase_order_id: (data.purchase_order_id as string | null) ?? null,
    purchase_order_number: (purchaseOrder?.voucher_number as string | null) ?? null,
    tax_treatment: data.tax_treatment as PurchaseBillRow["tax_treatment"],
    tax_supply_nature: supplyNature,
    tax_mechanism: mechanism,
    rcm_applicable: data.rcm_applicable === true,
    total_gross_amount: formatDecimal(data.total_gross_amount),
    total_tax_amount: formatDecimal(data.total_tax_amount),
    total_liability_amount: formatDecimal(data.total_liability_amount),
    match_status: (data.match_status as string | null) ?? "MATCHED",
    document_status: (data.document_status as string | null) ?? "ACTIVE",
    is_paid: data.is_paid === true,
    created_at: data.created_at as string,
    lines,
    linked_goods_receipts,
  };
}
