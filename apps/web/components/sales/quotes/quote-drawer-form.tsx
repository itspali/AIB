"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  approveSalesQuotation,
  convertQuotationToInvoice,
  convertQuotationToOrder,
  loadSalesQuotationDetail,
  rejectSalesQuotation,
  resolveQuoteLineSku,
  saveSalesQuotation,
  submitSalesQuotationForApproval,
} from "@/app/sales/quotes/actions";
import { QuoteLineEntryTable } from "@/components/sales/quotes/quote-line-entry-table";
import { QuotePeekView } from "@/components/sales/quotes/quote-peek-view";
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
  defaultQuoteDraftForm,
  ensureTrailingQuoteLine,
  filterSavableQuoteLines,
  mapSalesQuoteToDraft,
  type QuoteDraftFormState,
} from "@/lib/sales/quotes/draft-form";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";
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
  peekQuote: SalesQuoteRow | null;
  peekRecordId: string | null;
  editQuoteId: string | null;
  editAccessGranted: boolean;
  onClose: () => void;
  onAfterSave: (quoteId: string) => void;
  onOpenEdit?: (quoteId: string) => void;
};

export function QuoteDrawerForm({
  open,
  surface,
  customers,
  locations,
  peekQuote,
  peekRecordId,
  editQuoteId,
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

  const [form, setForm] = useState<QuoteDraftFormState>(() =>
    defaultQuoteDraftForm(locations, customers)
  );
  const [detail, setDetail] = useState<SalesQuoteRow | null>(peekQuote);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (isCreating) {
      setForm(defaultQuoteDraftForm(locations, customers));
      setDetail(null);
      setError(null);
      return;
    }
    if (surface === "peek" && peekQuote) {
      setDetail(peekQuote);
      return;
    }
    const quoteId = editQuoteId ?? peekRecordId;
    if (!quoteId) return;

    setDetailLoading(true);
    loadSalesQuotationDetail(quoteId)
      .then((result) => {
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setDetail(result.quote);
        if (isEditing) {
          setForm(mapSalesQuoteToDraft(result.quote));
        }
      })
      .finally(() => setDetailLoading(false));
  }, [open, surface, isCreating, isEditing, editQuoteId, peekRecordId, peekQuote, locations, customers]);

  const handleResolveSku = useCallback((key: string, sku: string) => {
    startTransition(async () => {
      const result = await resolveQuoteLineSku(sku);
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
        lines: ensureTrailingQuoteLine(
          current.lines.map((line) =>
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
          )
        ),
      }));
    });
  }, []);

  const handleSave = () => {
    startTransition(async () => {
      setError(null);
      const savableLines = filterSavableQuoteLines(form.lines);
      if (savableLines.length === 0) {
        setError("Add at least one complete line.");
        return;
      }

      const result = await saveSalesQuotation({
        sales_quotation_id: editQuoteId,
        customer_id: form.customer_id,
        origin_location_id: form.origin_location_id || null,
        billing_state: form.billing_state,
        shipping_state: form.shipping_state,
        valid_until: form.valid_until,
        payment_terms_days: Number(form.payment_terms_days) || 0,
        custom_fields: form.custom_fields,
        lines: savableLines.map((line) => ({
          variant_id: line.variant_id,
          quantity_quoted: line.quantity_quoted,
          unit_price_selling: line.unit_price_selling,
          discount_percentage: line.discount_percentage,
          discount_amount: line.discount_amount,
        })),
      });

      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }

      toast.success(editQuoteId ? "Quote updated." : "Quote saved.");
      onAfterSave(result.quotationId!);
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
      toast.success("Quote updated.");
      if (detail?.id) onAfterSave(detail.id);
    });
  };

  const title =
    surface === "create"
      ? "New quote"
      : surface === "edit"
        ? "Edit quote"
        : detail?.quotation_number ?? "Quote";

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
            <p className="text-sm text-muted-foreground">Loading quote…</p>
          ) : detail ? (
            <div className="space-y-4">
              <QuotePeekView quote={detail} />
              <div className="flex flex-wrap gap-2">
                {editAccessGranted && detail && canEditSalesDocument(detail.commercial_status) ? (
                  <Button variant="outline" onClick={() => onOpenEdit?.(detail.id)}>
                    Edit
                  </Button>
                ) : null}
                {detail.commercial_status === "APPROVED_ACTIVE" && !detail.converted_to_order_id ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      runWorkflow(() =>
                        convertQuotationToOrder({ quotation_id: detail.id })
                      )
                    }
                    disabled={isPending}
                  >
                    Convert to order
                  </Button>
                ) : null}
                {detail.commercial_status === "APPROVED_ACTIVE" && !detail.converted_to_invoice_id ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      runWorkflow(() =>
                        convertQuotationToInvoice({
                          quotation_id: detail.id,
                          origin_location_id: detail.origin_location_id,
                        })
                      )
                    }
                    disabled={isPending}
                  >
                    Convert to invoice
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Quote not found.</p>
          )
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            {error ? <UserFacingErrorMessage message={error} /> : null}
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
              <div className="space-y-2 sm:col-span-2">
                <Label>Valid until</Label>
                <Input
                  type="datetime-local"
                  value={form.valid_until ? form.valid_until.slice(0, 16) : ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      valid_until: event.target.value
                        ? new Date(event.target.value).toISOString()
                        : current.valid_until,
                    }))
                  }
                />
              </div>
            </div>

            <QuoteLineEntryTable
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
              {editQuoteId ? (
                <>
                  <Button
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      runWorkflow(() =>
                        submitSalesQuotationForApproval({ quotation_id: editQuoteId })
                      )
                    }
                  >
                    Submit for approval
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      runWorkflow(() => approveSalesQuotation({ quotation_id: editQuoteId }))
                    }
                  >
                    Approve
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
                          rejectSalesQuotation({
                            quotation_id: editQuoteId,
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
