"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { savePurchaseBill } from "@/app/procurement/bills/actions";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { gstTaxMechanismLabel } from "@/lib/tax/gst-supply-context";
import { poTaxSupplyNatureLabel } from "@/lib/procurement/purchase-orders/po-tax-supply";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";
import type { ReceivablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";

type Props = {
  initialBills: PurchaseBillRow[];
  suppliers: ProcurementSupplierOption[];
  locations: ProcurementLocationOption[];
  receivableOrders: ReceivablePurchaseOrderOption[];
};

export function BillManagementTerminal({
  initialBills,
  suppliers,
  locations,
  receivableOrders,
}: Props) {
  const [bills] = useState(initialBills);
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [poId, setPoId] = useState<string>("none");
  const [vendorInvoice, setVendorInvoice] = useState("");
  const [lineQty, setLineQty] = useState("1");
  const [linePrice, setLinePrice] = useState("0");

  const selectedPo = useMemo(
    () => (poId === "none" ? null : receivableOrders.find((row) => row.id === poId) ?? null),
    [poId, receivableOrders]
  );

  const firstLine = selectedPo?.lines[0] ?? null;

  const handleSave = () => {
    if (!supplierId || !locationId || !vendorInvoice.trim()) {
      toast.error("Supplier, location, and vendor invoice number are required.");
      return;
    }
    const variantId = firstLine?.variant_id;
    if (!variantId) {
      toast.error("Select a purchase order with at least one open line.");
      return;
    }

    startTransition(async () => {
      const result = await savePurchaseBill({
        supplier_id: supplierId,
        billing_location_id: locationId,
        invoice_number_vendor: vendorInvoice.trim(),
        purchase_order_id: selectedPo?.id ?? null,
        lines: [
          {
            variant_id: variantId,
            purchase_order_item_id: firstLine?.id ?? null,
            quantity_billed: lineQty,
            unit_price_billed: linePrice || firstLine?.unit_price_contractual || "0",
          },
        ],
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Bill saved");
      setShowForm(false);
    });
  };

  return (
    <ListModuleShell
      title={
        <ListModulePageTitleHeader
          title="Bills"
          description="Record supplier bills and match them to purchase orders and receipts."
          createLabel={showForm ? "Close form" : "New bill"}
          onCreate={() => setShowForm((value) => !value)}
          aboutAriaLabel="About Bills"
        />
      }
    >

      {showForm ? (
        <div className="surface-inset mb-4 grid max-w-3xl grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Billing location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Purchase order (optional)</Label>
            <Select value={poId} onValueChange={setPoId}>
              <SelectTrigger>
                <SelectValue placeholder="No PO" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No purchase order</SelectItem>
                {receivableOrders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    {order.voucher_number} — {order.supplier_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Vendor invoice #</Label>
            <Input value={vendorInvoice} onChange={(event) => setVendorInvoice(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Qty</Label>
            <Input value={lineQty} onChange={(event) => setLineQty(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Unit price</Label>
            <Input
              value={linePrice}
              placeholder={firstLine?.unit_price_contractual ?? "0"}
              onChange={(event) => setLinePrice(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button disabled={isPending} onClick={handleSave}>
              {isPending ? "Saving…" : "Save bill"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="surface-inset overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-2.5">Vendor invoice</th>
              <th className="p-2.5">System #</th>
              <th className="p-2.5">Supplier</th>
              <th className="p-2.5">Supply</th>
              <th className="p-2.5 text-right">Tax</th>
              <th className="p-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id} className="border-t border-border/60">
                <td className="p-2.5 font-medium">{bill.invoice_number_vendor}</td>
                <td className="p-2.5 font-mono text-xs">{bill.system_voucher_number}</td>
                <td className="p-2.5">{bill.supplier_name}</td>
                <td className="p-2.5 text-muted-foreground">
                  {bill.tax_supply_nature
                    ? poTaxSupplyNatureLabel(bill.tax_supply_nature)
                    : "—"}{" "}
                  · {gstTaxMechanismLabel(bill.tax_mechanism)}
                  {bill.rcm_applicable ? " · RCM" : ""}
                </td>
                <td className="p-2.5 text-right tabular-nums">{bill.total_tax_amount}</td>
                <td className="p-2.5 text-right tabular-nums">{bill.total_liability_amount}</td>
              </tr>
            ))}
            {bills.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No bills recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </ListModuleShell>
  );
}
