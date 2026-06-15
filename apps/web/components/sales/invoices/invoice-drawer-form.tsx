"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  approveSalesInvoice,
  loadSalesInvoiceDetail,
  loadSalesInvoicePrefillFromOrder,
  postSalesInvoice,
  rejectSalesInvoice,
  saveSalesInvoice,
  submitSalesInvoiceForApproval,
} from "@/app/sales/invoices/actions";
import { InvoiceDocumentEditorShell } from "@/components/sales/invoices/invoice-document-editor-shell";
import { InvoicePaymentPanel } from "@/components/sales/invoices/invoice-payment-panel";
import { InvoicePeekView } from "@/components/sales/invoices/invoice-peek-view";
import { RightDrawer } from "@/components/ui/right-drawer";
import { Button } from "@/components/ui/button";
import { UserFacingErrorMessage } from "@/components/ui/user-facing-error-message";
import {
  defaultInvoiceDraftForm,
  filterSavableInvoiceLines,
  mapSalesInvoiceToDraft,
  type InvoiceDraftFormState,
} from "@/lib/sales/invoices/draft-form";
import type { SalesInvoiceRow } from "@/lib/sales/invoices/types";
import { canEditSalesDocument } from "@/lib/sales/shared/document-status";
import type { DrawerSurface } from "@/lib/layout/module-drawer-url";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import { DEFAULT_SALES_INVOICE_SCREEN_LAYOUT } from "@/lib/sales/shared/sales-commerce-layout";
import { buildSalesCommerceSaveExtras } from "@/lib/sales/shared/sales-commerce-save-extras";
import { resolveSalesCommerceSupplyStates } from "@/lib/sales/shared/sales-commerce-draft";
import { useSalesDrawerFormLayout } from "@/lib/sales/shared/sales-drawer-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import { cn } from "@/lib/utils";

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
  defaultCurrency?: string;
  documentLayout?: DocumentLayoutTemplate;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
  allowLineItemDiscounts?: boolean;
  allowTransactionDiscounts?: boolean;
  tenantCountry?: string | null;
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
  defaultCurrency = "USD",
  documentLayout = DEFAULT_SALES_INVOICE_SCREEN_LAYOUT,
  taxCodeOptions = [],
  allowLineItemDiscounts = true,
  allowTransactionDiscounts = false,
  tenantCountry = null,
  onClose,
  onAfterSave,
  onOpenEdit,
}: Props) {
  const readOnly = surface === "peek";
  const isEditing = surface === "edit";
  const isCreating = surface === "create";
  const isMutating = isCreating || isEditing;
  const { lineTableFillHeight, useDrawerBodyScroll } = useSalesDrawerFormLayout(isMutating);
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating,
  });

  const entryLineKey = useId();
  const [form, setForm] = useState<InvoiceDraftFormState>(() =>
    defaultInvoiceDraftForm(locations, customers, null, entryLineKey, defaultCurrency)
  );
  const [detail, setDetail] = useState<SalesInvoiceRow | null>(peekInvoice);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const resolvedPeekRecordId = surface === "peek" ? (peekInvoice?.id ?? peekRecordId) : null;

  useEffect(() => {
    if (!open) return;
    if (isCreating) {
      if (createPrefillSoId) {
        setDetailLoading(true);
        loadSalesInvoicePrefillFromOrder(createPrefillSoId)
          .then((result) => {
            if ("error" in result) {
              setError(result.error ?? "Unable to load prefill.");
              setForm(
                defaultInvoiceDraftForm(
                  locations,
                  customers,
                  null,
                  entryLineKey,
                  defaultCurrency
                )
              );
              return;
            }
            setForm(result.draft);
          })
          .finally(() => setDetailLoading(false));
      } else {
        setForm(
          defaultInvoiceDraftForm(locations, customers, null, entryLineKey, defaultCurrency)
        );
      }
      setDetail(null);
      setError(null);
      return;
    }
    if (surface === "peek") return;

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
        if (isEditing) setForm(mapSalesInvoiceToDraft(result.invoice, defaultCurrency));
      })
      .finally(() => setDetailLoading(false));
  }, [
    open,
    surface,
    isCreating,
    isEditing,
    editInvoiceId,
    peekRecordId,
    createPrefillSoId,
    locations,
    customers,
    entryLineKey,
    defaultCurrency,
  ]);

  useEffect(() => {
    if (!open || surface !== "peek" || !resolvedPeekRecordId) return;
    if (peekInvoice?.lines?.length) {
      setDetail(peekInvoice);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void loadSalesInvoiceDetail(resolvedPeekRecordId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDetail(result.invoice);
    });

    return () => {
      cancelled = true;
    };
  }, [open, peekInvoice, peekInvoice?.lines?.length, resolvedPeekRecordId, surface]);

  const patchForm = useCallback((patch: Partial<InvoiceDraftFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  const handleSave = () => {
    startTransition(async () => {
      setError(null);
      const savableLines = filterSavableInvoiceLines(form.lines);
      if (savableLines.length === 0) {
        setError("Add at least one complete line.");
        return;
      }

      const supplyStates = resolveSalesCommerceSupplyStates({
        customers,
        locations,
        customerId: form.customer_id,
        originLocationId: form.origin_location_id,
        billingState: form.billing_state,
        shippingState: form.shipping_state,
      });
      const result = await saveSalesInvoice({
        sales_invoice_id: editInvoiceId,
        customer_id: form.customer_id,
        origin_location_id: form.origin_location_id,
        billing_state: supplyStates.billing_state,
        shipping_state: supplyStates.shipping_state,
        source_order_id: form.source_order_id,
        source_quotation_id: form.source_quotation_id,
        custom_fields: form.custom_fields,
        lines: savableLines.map((line) => ({
          variant_id: line.variant_id,
          quantity_invoiced: line.quantity_invoiced,
          unit_price_selling: line.unit_price_selling,
          discount_percentage: line.discount_percentage,
          discount_amount: line.discount_amount,
          source_order_line_id: line.source_order_line_id,
        })),
        ...buildSalesCommerceSaveExtras(form, savableLines, {
          allowTransactionDiscounts,
        }),
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

  const headerActions = readOnly ? (
    <>
      {editAccessGranted && detail && canEditSalesDocument(detail.commercial_status) ? (
        <Button type="button" size="sm" variant="outline" onClick={() => onOpenEdit?.(detail.id)}>
          Edit
        </Button>
      ) : null}
      {detail?.commercial_status === "DRAFT" ? (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => runWorkflow(() => postSalesInvoice({ sales_invoice_id: detail.id }))}
        >
          Post invoice
        </Button>
      ) : null}
    </>
  ) : isMutating ? (
    <>
      <Button type="button" size="sm" disabled={isPending || detailLoading} onClick={handleSave}>
        {isPending ? "Saving…" : "Save draft"}
      </Button>
      {editInvoiceId ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              runWorkflow(() => submitSalesInvoiceForApproval({ sales_invoice_id: editInvoiceId }))
            }
          >
            Submit for approval
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              runWorkflow(() => approveSalesInvoice({ sales_invoice_id: editInvoiceId }))
            }
          >
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() => runWorkflow(() => postSalesInvoice({ sales_invoice_id: editInvoiceId }))}
          >
            Post
          </Button>
        </>
      ) : null}
    </>
  ) : null;

  const drawerBody = (
    <>
      {error ? <UserFacingErrorMessage message={error} className="mb-4 shrink-0" /> : null}
      {readOnly ? (
        detailLoading ? (
          <p className="text-sm text-muted-foreground">Loading invoice…</p>
        ) : detail ? (
          <div className="space-y-4">
            <InvoicePeekView
              invoice={detail}
              layout={documentLayout}
              allowLineItemDiscounts={allowLineItemDiscounts}
              customers={customers}
              locations={locations}
            />
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
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Invoice not found.</p>
        )
      ) : detailLoading ? (
        <p className="text-sm text-muted-foreground">Loading prefill…</p>
      ) : (
        <InvoiceDocumentEditorShell
          form={form}
          locations={locations}
          customers={customers}
          defaultCurrency={defaultCurrency}
          documentLayout={documentLayout}
          allowLineItemDiscounts={allowLineItemDiscounts}
          allowTransactionDiscounts={allowTransactionDiscounts}
          taxCodeOptions={taxCodeOptions}
          tenantCountry={tenantCountry}
          isPending={isPending}
          onPatch={patchForm}
          onLinesChange={(linesOrUpdater) => {
            setForm((current) => ({
              ...current,
              lines:
                typeof linesOrUpdater === "function"
                  ? linesOrUpdater(current.lines)
                  : linesOrUpdater,
            }));
          }}
        />
      )}
      {editInvoiceId && isMutating ? (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <input
            className="h-8 min-w-[12rem] flex-1 rounded-md border border-input bg-background px-2 text-sm"
            placeholder="Rejection reason"
            value={rejectNotes}
            onChange={(event) => setRejectNotes(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
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
      ) : null}
    </>
  );

  return (
    <>
      <RightDrawer
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose(onClose);
        }}
        onRequestClose={() => requestClose(onClose)}
        title={title}
        headerActions={headerActions}
        allowBackgroundInteraction={surface === "peek"}
        className={surface === "peek" ? "module-drawer-peek-shell" : undefined}
        bodyClassName={
          surface === "peek"
            ? "module-drawer-peek-body"
            : isMutating
              ? cn(
                  "module-drawer-form-body",
                  useDrawerBodyScroll && "module-drawer-form-body-scroll"
                )
              : undefined
        }
        scrollable={useDrawerBodyScroll || !(isMutating && lineTableFillHeight)}
        showCloseButton
      >
        <div className={cn(isMutating && useDrawerBodyScroll && "shrink-0 pb-6")}>{drawerBody}</div>
      </RightDrawer>
      {discardDialog}
    </>
  );
}
