"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  acknowledgePortalPurchaseOrder,
  registerSupplierInvoiceUpload,
} from "@/app/portal/actions";
import { Badge } from "@/components/ui/badge";
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
import { formatDate } from "@/lib/dashboard/format";
import { purchaseOrderStatusLabel } from "@/lib/procurement/purchase-orders/labels";
import type {
  SupplierPortalContext,
  SupplierPortalPurchaseOrderRow,
} from "@/lib/supplier-portal/queries";
import { createClient } from "@/lib/supabase/client";

type Props = {
  portal: SupplierPortalContext;
  orders: SupplierPortalPurchaseOrderRow[];
  tenantId: string;
};

export function SupplierPortalPurchaseOrdersTerminal({ portal, orders, tenantId }: Props) {
  const [rows, setRows] = useState(orders);
  const [isPending, startTransition] = useTransition();
  const [uploadPoId, setUploadPoId] = useState<string>("");
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAcknowledge = (purchaseOrderId: string) => {
    startTransition(async () => {
      const result = await acknowledgePortalPurchaseOrder(purchaseOrderId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setRows((current) =>
        current.map((row) =>
          row.id === purchaseOrderId
            ? { ...row, supplier_acknowledged_at: new Date().toISOString() }
            : row
        )
      );
      toast.success("Purchase order acknowledged.");
    });
  };

  const handleUpload = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a PDF or image file to upload.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const uploadId = crypto.randomUUID();
      const storagePath = `${tenantId}/${portal.supplierEntityId}/${uploadId}/${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("supplier-invoices")
        .upload(storagePath, file, {
          contentType: file.type || undefined,
          upsert: false,
        });

      if (uploadError) {
        toast.error(uploadError.message);
        return;
      }

      const result = await registerSupplierInvoiceUpload({
        purchaseOrderId: uploadPoId || null,
        storagePath,
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type || null,
        vendorInvoiceNumber: vendorInvoiceNumber.trim() || null,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
      setVendorInvoiceNumber("");
      toast.success("Invoice uploaded for AP review.");
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Purchase orders</h2>
        <p className="text-sm text-muted-foreground">
          Signed in as supplier <span className="font-medium text-foreground">{portal.supplierName}</span>
        </p>
      </div>

      <section className="rounded-md border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Upload supplier invoice</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Files are queued for your AP team — no bill is posted automatically.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="portal-po">Linked PO (optional)</Label>
            <Select value={uploadPoId || "__none__"} onValueChange={(value) => setUploadPoId(value === "__none__" ? "" : value)}>
              <SelectTrigger id="portal-po" className="h-9">
                <SelectValue placeholder="No PO link" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No PO link</SelectItem>
                {rows.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.voucher_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="portal-vendor-invoice">Vendor invoice #</Label>
            <Input
              id="portal-vendor-invoice"
              value={vendorInvoiceNumber}
              onChange={(event) => setVendorInvoiceNumber(event.target.value)}
              placeholder="INV-12345"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="portal-invoice-file">Invoice file</Label>
            <Input
              id="portal-invoice-file"
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
            />
          </div>
        </div>
        <Button className="mt-3" size="sm" disabled={isPending} onClick={handleUpload}>
          {isPending ? "Uploading…" : "Upload invoice"}
        </Button>
      </section>

      <section className="overflow-hidden rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">PO number</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Destination</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Acknowledged</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={7}>
                  No issued purchase orders are available for your supplier account.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="px-3 py-2 font-mono text-xs">{row.voucher_number}</td>
                  <td className="px-3 py-2">
                    <Badge variant="administrative" className="text-xs font-normal">
                      {purchaseOrderStatusLabel(row.document_status as import("@/lib/procurement/purchase-orders/types").PurchaseOrderStatus)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">{row.destination_location_name}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.total_net_amount} {row.currency_code}
                  </td>
                  <td className="px-3 py-2">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-2">
                    {row.supplier_acknowledged_at ? formatDate(row.supplier_acknowledged_at) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!row.supplier_acknowledged_at &&
                    (row.document_status === "ISSUED_ACTIVE" ||
                      row.document_status === "PARTIALLY_FULFILLED") ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => handleAcknowledge(row.id)}
                      >
                        Acknowledge
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
