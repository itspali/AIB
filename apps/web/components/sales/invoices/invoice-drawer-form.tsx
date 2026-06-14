"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  approveSalesInvoice,
  loadSalesInvoiceDetail,
  loadSalesInvoicePrefillFromOrder,
  postSalesInvoice,
  rejectSalesInvoice,
  resolveInvoiceLineSku,
  saveSalesInvoice,
  submitSalesInvoiceForApproval,
} from "@/app/sales/invoices/actions";
import { InvoiceLineEntryTable } from "@/components/sales/invoices/invoice-line-entry-table";
import { InvoicePaymentPanel } from "@/components/sales/invoices/invoice-payment-panel";
import { InvoicePeekView } from "@/components/sales/invoices/invoice-peek-view";
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
import {
  customerDefaultStates,
  defaultInvoiceDraftForm,
  filterSavableInvoiceLines,
  mapSalesInvoiceToDraft,
  type InvoiceDraftFormState,
} from "@/lib/sales/invoices/draft-form";
import type { SalesInvoiceRow } from "@/lib/sales/invoices/types";
import { canEditSalesDocument } from "@/lib/sales/shared/document-status";
import type { DrawerSurface } from "@/lib/layout/module-drawer-url";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import { useDocumentLineTableFillHeight } from "@/lib/documents/use-document-line-table-fill-height";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";

type Props = {
  open: boolean;
  surface: DrawerSurface;
  customers: CustomerOption[];
  locations: SalesLocationOption[];
  peekInvoice: SalesInvoiceRow | null;
  peekRecordId: string | null;
  editInvoiceId: string | null;
  createPrefillSoId?: string | null;
  editAccessGranted: boolean;
  onClose: () => void;
  onAfterSave: (invoiceId: string) => void;
  onOpenEdit?: (invoiceId: string) => void;
};

export function InvoiceDrawerForm({
  open,
  surface,
  customers,
  locations,
  peekInvoice,
  peekRecordId,
  editInvoiceId,
  createPrefillSoId = null,
  editAccessGranted,
  onClose,
  onAfterSave,
  onOpenEdit,
}: Props) {
  const readOnly = surface === "peek";
  const isEditing = surface === "edit";
  const isCreating = surface === "create";
  const isMutating = isCreating || isEditing;
  const lineTableFillHeight = useDocumentLineTableFillHeight(isMutating);
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating,
  });

  const [form, setForm] = useState<InvoiceDraftFormState>(() =>
    defaultInvoiceDraftForm(locations, customers)
  );
  const [detail, setDetail] = useState<SalesInvoiceRow | null>(peekInvoice);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (isCreating) {
      if (createPrefillSoId) {
        setDetailLoading(true);
        loadSalesInvoicePrefillFromOrder(createPrefillSoId)
          .then((result) => {
            if ("error" in result) {
              setError(result.error ?? "Unable to load prefill.");
              setForm(defaultInvoiceDraftForm(locations, customers));
              return;
            }
            setForm(result.draft);
          })
          .finally(() => setDetailLoading(false));
      } else {
        setForm(defaultInvoiceDraftForm(locations, customers));
      }
      setDetail(null);
      setError(null);
      return;
    }
    if (surface === "peek" && peekInvoice) {
      setDetail(peekInvoice);
      return;
    }
    const invoiceId = editInvoiceId ?? peekRecordId;
    if (!invoiceId) return;

    setDetailLoading(true);
    loadSalesInvoiceDetail(invoiceId)
      .then((result) => {
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setDetail(result.invoice);
        if (isEditing) setForm(mapSalesInvoiceToDraft(result.invoice));
      })
      .finally(() => setDetailLoading(false));
  }, [
    open,
    surface,
    isCreating,
    isEditing,
    editInvoiceId,
    peekRecordId,
    peekInvoice,
    createPrefillSoId,
    locations,
    customers,
  ]);

  const handleResolveSku = useCallback((key: string, sku: string) => {
    startTransition(async () => {
      const result = await resolveInvoiceLineSku(sku);
      if ("error" in result && result.error) {
        setForm((current) => ({
          ...current,
          lines: current.lines.map((line) =>
            line.key === key ? { ...line, skuError: result.error ?? "SKU not found." } : line
          ),
        }));
        return;
      }
      if (!("variant" in result) || !result.variant) return;
      const variant = result.variant;
      setForm((current) => ({
        ...current,
        lines: current.lines.map((line) =>
          line.key === key
            ? {
                ...line,
                sku: variant.variant_sku,
                variant_id: variant.variant_id,
                item_id: variant.item_id,
                item_name: variant.item_name,
                variant_sku: variant.variant_sku,
                skuError: null,
              }
            : line
        ),
      }));
    });
  }, []);

  const handleSave = () => {
    startTransition(async () => {
      setError(null);
      const savableLines = filterSavableInvoiceLines(form.lines);
      if (savableLines.length === 0) {
        setError("Add at least one complete line.");
        return;
      }

      const result = await saveSalesInvoice({
        sales_invoice_id: editInvoiceId,
        customer_id: form.customer_id,
        origin_location_id: form.origin_location_id,
        billing_state: form.billing_state,
        shipping_state: form.shipping_state,
        source_order_id: form.source_order_id,
        source_quotation_id: form.source_quotation_id,
        payment_terms_days: Number(form.payment_terms_days) || 0,
        custom_fields: form.custom_fields,
        lines: savableLines.map((line) => ({
          variant_id: line.variant_id,
          quantity_invoiced: line.quantity_invoiced,
          unit_price_selling: line.unit_price_selling,
          discount_percentage: line.discount_percentage,
          discount_amount: line.discount_amount,
          source_order_line_id: line.source_order_line_id,
        })),
      });

      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }

      toast.success(editInvoiceId ? "Invoice updated." : "Invoice saved.");
      onAfterSave(result.salesInvoiceId!);
    });
  };

  const runWorkflow = (action: () => Promise<{ error?: string; success?: boolean }>) => {
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("Invoice updated.");
      if (detail?.id) onAfterSave(detail.id);
    });
  };

  const title =
    surface === "create"
      ? "New invoice"
      : surface === "edit"
        ? "Edit invoice"
        : detail?.invoice_number ?? "Invoice";

  return (
    <>
      <RightDrawer
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose(onClose);
        }}
        onRequestClose={() => requestClose(onClose)}
        title={title}
      >
        {readOnly ? (
          detailLoading ? (
            <p className="text-sm text-muted-foreground">Loading invoice…</p>
          ) : detail ? (
            <div className="space-y-4">
              <InvoicePeekView invoice={detail} />
              {detail.commercial_status === "APPROVED_ACTIVE" ? (
                <InvoicePaymentPanel
                  salesInvoiceId={detail.id}
                  customerId={detail.customer_id}
                  invoiceNetAmount={detail.total_net_amount}
                  totalPaidAmount={detail.total_paid_amount}
                  invoicePaymentStatus={detail.invoice_payment_status}
                  onApplied={() => {
                    void loadSalesInvoiceDetail(detail.id).then((result) => {
                      if ("invoice" in result) setDetail(result.invoice);
                    });
                  }}
                />
              ) : null}
              {editAccessGranted && canEditSalesDocument(detail.commercial_status) ? (
                <Button variant="outline" onClick={() => onOpenEdit?.(detail.id)}>
                  Edit
                </Button>
              ) : null}
              {detail.commercial_status === "DRAFT" ? (
                <Button
                  disabled={isPending}
                  onClick={() =>
                    runWorkflow(() => postSalesInvoice({ sales_invoice_id: detail.id }))
                  }
                >
                  Post invoice
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Invoice not found.</p>
          )
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            {error ? <UserFacingErrorMessage message={error} /> : null}
            {detailLoading ? (
              <p className="text-sm text-muted-foreground">Loading prefill…</p>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select
                  value={form.customer_id}
                  onValueChange={(customerId) => {
                    const states = customerDefaultStates(customers, customerId);
                    setForm((current) => ({
                      ...current,
                      customer_id: customerId,
                      billing_state: states.billing_state,
                      shipping_state: states.shipping_state,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Origin location</Label>
                <Select
                  value={form.origin_location_id}
                  onValueChange={(originLocationId) =>
                    setForm((current) => ({ ...current, origin_location_id: originLocationId }))
                  }
                >
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
              <div className="space-y-2">
                <Label>Billing state</Label>
                <Input
                  value={form.billing_state}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, billing_state: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Shipping state</Label>
                <Input
                  value={form.shipping_state}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, shipping_state: event.target.value }))
                  }
                />
              </div>
            </div>

            <InvoiceLineEntryTable
              lines={form.lines}
              disabled={isPending}
              fillHeight={lineTableFillHeight}
              onChange={(lines) =>
                setForm((current) => ({
                  ...current,
                  lines: typeof lines === "function" ? lines(current.lines) : lines,
                }))
              }
              onResolveSku={handleResolveSku}
            />

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button onClick={handleSave} disabled={isPending}>
                Save draft
              </Button>
              {editInvoiceId ? (
                <>
                  <Button
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      runWorkflow(() =>
                        submitSalesInvoiceForApproval({ sales_invoice_id: editInvoiceId })
                      )
                    }
                  >
                    Submit for approval
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      runWorkflow(() => approveSalesInvoice({ sales_invoice_id: editInvoiceId }))
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      runWorkflow(() => postSalesInvoice({ sales_invoice_id: editInvoiceId }))
                    }
                  >
                    Post
                  </Button>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
                    <Input
                      placeholder="Rejection reason"
                      value={rejectNotes}
                      onChange={(event) => setRejectNotes(event.target.value)}
                    />
                    <Button
                      variant="destructive"
                      disabled={isPending || !rejectNotes.trim()}
                      onClick={() =>
                        runWorkflow(() =>
                          rejectSalesInvoice({
                            sales_invoice_id: editInvoiceId,
                            notes: rejectNotes.trim(),
                          })
                        )
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </RightDrawer>
      {discardDialog}
    </>
  );
}
