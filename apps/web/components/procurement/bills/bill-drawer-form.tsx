"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { savePurchaseBill } from "@/app/procurement/bills/actions";
import { DocumentPostingSummaryPanel } from "@/components/documents/document-posting-summary-panel";
import { RightDrawer } from "@/components/ui/right-drawer";
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
import { UserFacingErrorMessage } from "@/components/ui/user-facing-error-message";
import type { PostingStepResult } from "@/lib/documents/posting-types";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import type { ReceivablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";

type Props = {
  open: boolean;
  suppliers: ProcurementSupplierOption[];
  locations: ProcurementLocationOption[];
  receivableOrders: ReceivablePurchaseOrderOption[];
  goodsReceipts: GoodsReceiptRow[];
  peekBill: PurchaseBillRow | null;
  onClose: () => void;
  onAfterSave: () => void;
};

export function BillDrawerForm({
  open,
  suppliers,
  locations,
  receivableOrders,
  goodsReceipts,
  peekBill,
  onClose,
  onAfterSave,
}: Props) {
  const readOnly = Boolean(peekBill);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [poId, setPoId] = useState<string>("none");
  const [grnId, setGrnId] = useState<string>("none");
  const [vendorInvoice, setVendorInvoice] = useState("");
  const [lineQty, setLineQty] = useState("1");
  const [linePrice, setLinePrice] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [postingSteps, setPostingSteps] = useState<PostingStepResult[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedPo =
    poId === "none" ? null : receivableOrders.find((row) => row.id === poId) ?? null;
  const firstLine = selectedPo?.lines[0] ?? null;

  const handleSave = useCallback(() => {
    setError(null);
    if (!supplierId || !locationId || !vendorInvoice.trim()) {
      setError("Supplier, location, and vendor invoice number are required.");
      return;
    }
    const variantId = firstLine?.variant_id;
    if (!variantId) {
      setError("Select a purchase order with at least one open line.");
      return;
    }

    startTransition(async () => {
      const result = await savePurchaseBill({
        supplier_id: supplierId,
        billing_location_id: locationId,
        invoice_number_vendor: vendorInvoice.trim(),
        purchase_order_id: selectedPo?.id ?? null,
        goods_receipt_ids: grnId === "none" ? [] : [grnId],
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
        setError(result.error ?? "Unable to save bill.");
        return;
      }

      toast.success("Supplier bill saved");
      setPostingSteps(result.steps ?? []);
      onAfterSave();
    });
  }, [
    firstLine,
    grnId,
    linePrice,
    lineQty,
    locationId,
    onAfterSave,
    selectedPo,
    supplierId,
    vendorInvoice,
  ]);

  return (
    <RightDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      onRequestClose={onClose}
      title={peekBill?.system_voucher_number ?? "New supplier bill"}
      headerActions={
        readOnly || postingSteps ? (
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        ) : (
          <Button size="sm" disabled={isPending} onClick={handleSave}>
            {isPending ? "Saving…" : "Save bill"}
          </Button>
        )
      }
    >
      {error ? <UserFacingErrorMessage message={error} className="mb-4" /> : null}

      {postingSteps?.length ? (
        <DocumentPostingSummaryPanel steps={postingSteps} overall="success" />
      ) : readOnly && peekBill ? (
        <div className="space-y-4 text-sm">
          <p>
            <span className="text-muted-foreground">Vendor invoice:</span>{" "}
            {peekBill.invoice_number_vendor}
          </p>
          <p>
            <span className="text-muted-foreground">Match status:</span> {peekBill.match_status}
          </p>
          <p>
            <span className="text-muted-foreground">Amount due:</span> {peekBill.total_liability_amount}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue />
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
                  <SelectValue />
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
            <div className="space-y-2">
              <Label>Purchase order</Label>
              <Select value={poId} onValueChange={setPoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {receivableOrders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.voucher_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Goods receipt</Label>
              <Select value={grnId} onValueChange={setGrnId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {goodsReceipts.map((grn) => (
                    <SelectItem key={grn.id} value={grn.id}>
                      {grn.voucher_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Vendor invoice number</Label>
            <Input value={vendorInvoice} onChange={(event) => setVendorInvoice(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity billed</Label>
              <Input
                inputMode="decimal"
                value={lineQty}
                onChange={(event) => setLineQty(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Unit price billed</Label>
              <Input
                inputMode="decimal"
                value={linePrice}
                onChange={(event) => setLinePrice(event.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </RightDrawer>
  );
}
