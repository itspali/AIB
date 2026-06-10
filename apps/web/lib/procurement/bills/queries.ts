import type { SupabaseClient } from "@supabase/supabase-js";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";
import type { PoTaxSupplyNature } from "@/lib/procurement/purchase-orders/po-tax-supply";
import { isPoTaxSupplyNature } from "@/lib/procurement/purchase-orders/po-tax-supply";
import type { GstTaxMechanism } from "@/lib/tax/gst-supply-context";

function formatDecimal(value: number | string | null | undefined): string {
  if (value == null || value === "") return "0";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "0";
}

export async function fetchPurchaseBills(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PurchaseBillRow[]> {
  const { data, error } = await supabase
    .from("purchase_invoices")
    .select(
      `id, invoice_number_vendor, system_voucher_number, supplier_id, purchase_order_id,
       tax_treatment, tax_supply_nature, tax_mechanism, rcm_applicable,
       total_gross_amount, total_tax_amount, total_liability_amount, is_paid, created_at,
       supplier:entities!purchase_invoices_supplier_tenant_fk (name)`
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const supplier = Array.isArray(row.supplier) ? row.supplier[0] : row.supplier;
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
      tax_treatment: row.tax_treatment as PurchaseBillRow["tax_treatment"],
      tax_supply_nature: supplyNature,
      tax_mechanism: mechanism,
      rcm_applicable: row.rcm_applicable === true,
      total_gross_amount: formatDecimal(row.total_gross_amount),
      total_tax_amount: formatDecimal(row.total_tax_amount),
      total_liability_amount: formatDecimal(row.total_liability_amount),
      is_paid: row.is_paid === true,
      created_at: row.created_at as string,
    };
  });
}
