"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  approveSalesQuotation,
  convertQuotationToInvoice,
  convertQuotationToOrder,
  loadSalesQuotationDetail,
  rejectSalesQuotation,
  saveSalesQuotation,
  submitSalesQuotationForApproval,
} from "@/app/sales/quotes/actions";
import { QuoteDocumentEditorShell } from "@/components/sales/quotes/quote-document-editor-shell";
import { QuotePeekView } from "@/components/sales/quotes/quote-peek-view";
import {
  SalesDocumentLinkPanel,
  toSalesDocumentLinkRef,
} from "@/components/sales/shared/sales-document-link-panel";
import {
  SalesDocumentConversionConfirmDialog,
  type SalesDocumentConversionKind,
} from "@/components/sales/shared/sales-document-conversion-confirm-dialog";
import { RightDrawer } from "@/components/ui/right-drawer";
import { Button } from "@/components/ui/button";
import { UserFacingErrorMessage } from "@/components/ui/user-facing-error-message";
import {
  defaultQuoteDraftForm,
  filterSavableQuoteLines,
  mapSalesQuoteToDraft,
  type QuoteDraftFormState,
} from "@/lib/sales/quotes/draft-form";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";
import type { SalesDocumentConversionMode } from "@/lib/sales/document-conversion-settings";
import {
  invoiceCreateFromQuoteHref,
  SALES_INVOICES_HREF,
  SALES_ORDERS_HREF,
  soCreateFromQuoteHref,
} from "@/lib/sales/navigation";
import { canEditSalesDocument } from "@/lib/sales/shared/document-status";
import type { DrawerSurface } from "@/lib/layout/module-drawer-url";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import { DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT } from "@/lib/sales/shared/sales-commerce-layout";
import { buildSalesCommerceSaveExtras } from "@/lib/sales/shared/sales-commerce-save-extras";
import { resolveSalesDraftLineUomCodeForSave } from "@/lib/sales/shared/sales-line-uom-options";
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
  peekQuote: SalesQuoteRow | null;
  peekRecordId: string | null;
  editQuoteId: string | null;
  editAccessGranted: boolean;
  defaultCurrency?: string;
  documentLayout?: DocumentLayoutTemplate;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
  allowLineItemDiscounts?: boolean;
  allowTransactionDiscounts?: boolean;
  tenantCountry?: string | null;
  preferredOriginLocationId?: string | null;
  documentConversionMode?: SalesDocumentConversionMode;
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
  defaultCurrency = "USD",
  documentLayout = DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT,
  taxCodeOptions = [],
  allowLineItemDiscounts = true,
  allowTransactionDiscounts = false,
  tenantCountry = null,
  preferredOriginLocationId = null,
  documentConversionMode = "prefill_form",
  onClose,
  onAfterSave,
  onOpenEdit,
}: Props) {
  const router = useRouter();
  const readOnly = surface === "peek";
  const isEditing = surface === "edit";
  const isCreating = surface === "create";
  const isMutating = isCreating || isEditing;
  const { lineTableFillHeight, useDrawerBodyScroll } = useSalesDrawerFormLayout(isMutating);
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating,
  });

  const entryLineKey = useId();
  const [form, setForm] = useState<QuoteDraftFormState>(() =>
    defaultQuoteDraftForm(
      locations,
      customers,
      preferredOriginLocationId,
      entryLineKey,
      defaultCurrency
    )
  );
  const [detail, setDetail] = useState<SalesQuoteRow | null>(peekQuote);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [conversionKind, setConversionKind] = useState<SalesDocumentConversionKind | null>(null);
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false);

  const resolvedPeekRecordId = surface === "peek" ? (peekQuote?.id ?? peekRecordId) : null;

  useEffect(() => {
    if (!open) return;
    if (isCreating) {
      setForm(
        defaultQuoteDraftForm(
          locations,
          customers,
          preferredOriginLocationId,
          entryLineKey,
          defaultCurrency
        )
      );
      setDetail(null);
      setError(null);
      return;
    }
    if (surface === "peek") return;

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
          setForm(mapSalesQuoteToDraft(result.quote, defaultCurrency));
        }
      })
      .finally(() => setDetailLoading(false));
  }, [
    open,
    surface,
    isCreating,
    isEditing,
    editQuoteId,
    peekRecordId,
    locations,
    customers,
    preferredOriginLocationId,
    entryLineKey,
    defaultCurrency,
  ]);

  useEffect(() => {
    if (!open || surface !== "peek" || !resolvedPeekRecordId) return;
    if (peekQuote?.lines?.length) {
      setDetail(peekQuote);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void loadSalesQuotationDetail(resolvedPeekRecordId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDetail(result.quote);
    });

    return () => {
      cancelled = true;
    };
  }, [open, peekQuote, peekQuote?.lines?.length, resolvedPeekRecordId, surface]);

  const patchForm = useCallback((patch: Partial<QuoteDraftFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  const reloadQuoteDetail = useCallback(async (quoteId: string) => {
    const result = await loadSalesQuotationDetail(quoteId);
    if ("quote" in result) {
      setDetail(result.quote);
    }
  }, []);

  const handleSave = () => {
    startTransition(async () => {
      setError(null);
      const savableLines = filterSavableQuoteLines(form.lines);
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
      const result = await saveSalesQuotation({
        sales_quotation_id: editQuoteId ?? detail?.id ?? null,
        customer_id: form.customer_id,
        origin_location_id: form.origin_location_id || null,
        billing_state: supplyStates.billing_state,
        shipping_state: supplyStates.shipping_state,
        valid_until: form.valid_until,
        custom_fields: form.custom_fields,
        lines: savableLines.map((line) => ({
          variant_id: line.variant_id,
          quantity_quoted: line.quantity_quoted,
          unit_price_selling: line.unit_price_selling,
          discount_percentage: line.discount_percentage,
          discount_amount: line.discount_amount,
          uom_code: resolveSalesDraftLineUomCodeForSave(line),
        })),
        ...buildSalesCommerceSaveExtras(form, savableLines, {
          allowTransactionDiscounts,
        }),
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

  const handleQuoteConversion = (kind: "quote_to_order" | "quote_to_invoice") => {
    if (!detail) return;

    if (documentConversionMode === "prefill_form") {
      const href =
        kind === "quote_to_order"
          ? soCreateFromQuoteHref(detail.id)
          : invoiceCreateFromQuoteHref(detail.id);
      router.push(href);
      return;
    }

    setConversionKind(kind);
    setConversionDialogOpen(true);
  };

  const handleConfirmConversion = () => {
    if (!detail || !conversionKind) return;

    startTransition(async () => {
      setError(null);
      const result =
        conversionKind === "quote_to_order"
          ? await convertQuotationToOrder({ quotation_id: detail.id })
          : await convertQuotationToInvoice({
              quotation_id: detail.id,
              origin_location_id: detail.origin_location_id,
            });

      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }

      setConversionDialogOpen(false);
      setConversionKind(null);
      toast.success(
        conversionKind === "quote_to_order" ? "Sales order created." : "Invoice created."
      );

      if (conversionKind === "quote_to_order" && "salesOrderId" in result && result.salesOrderId) {
        router.push(`${SALES_ORDERS_HREF}?id=${encodeURIComponent(result.salesOrderId)}`);
        return;
      }
      if ("salesInvoiceId" in result && result.salesInvoiceId) {
        router.push(`${SALES_INVOICES_HREF}?id=${encodeURIComponent(result.salesInvoiceId)}`);
      }
    });
  };

  const title =
    surface === "create"
      ? "New quote"
      : surface === "edit"
        ? "Edit quote"
        : detail?.quotation_number ?? "Quote";

  const headerActions = readOnly ? (
    <>
      {editAccessGranted && detail && canEditSalesDocument(detail.commercial_status) ? (
        <Button type="button" size="sm" variant="outline" onClick={() => onOpenEdit?.(detail.id)}>
          Edit
        </Button>
      ) : null}
      {detail?.commercial_status === "APPROVED_ACTIVE" && !detail.converted_to_order_id ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => handleQuoteConversion("quote_to_order")}
        >
          Convert to order
        </Button>
      ) : null}
      {detail?.commercial_status === "APPROVED_ACTIVE" && !detail.converted_to_invoice_id ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => handleQuoteConversion("quote_to_invoice")}
        >
          Convert to invoice
        </Button>
      ) : null}
    </>
  ) : isMutating ? (
    <>
      <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
        {isPending ? "Saving…" : "Save draft"}
      </Button>
      {editQuoteId ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              runWorkflow(() => submitSalesQuotationForApproval({ quotation_id: editQuoteId }))
            }
          >
            Submit for approval
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() => runWorkflow(() => approveSalesQuotation({ quotation_id: editQuoteId }))}
          >
            Approve
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
          <p className="text-sm text-muted-foreground">Loading quote…</p>
        ) : detail ? (
          <div className="space-y-6">
            <QuotePeekView
              quote={detail}
              layout={documentLayout}
              allowLineItemDiscounts={allowLineItemDiscounts}
              customers={customers}
              locations={locations}
            />
            <SalesDocumentLinkPanel
              documentType="quote"
              documentId={detail.id}
              customerId={detail.customer_id}
              editAccessGranted={editAccessGranted}
              convertedOrder={toSalesDocumentLinkRef(
                "sales_order",
                detail.converted_to_order_id,
                detail.converted_to_order_number
              )}
              convertedInvoice={toSalesDocumentLinkRef(
                "invoice",
                detail.converted_to_invoice_id,
                detail.converted_to_invoice_number
              )}
              onLinked={() => void reloadQuoteDetail(detail.id)}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Quote not found.</p>
        )
      ) : (
        <QuoteDocumentEditorShell
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
      {editQuoteId && isMutating ? (
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
      <SalesDocumentConversionConfirmDialog
        kind={conversionKind}
        open={conversionDialogOpen}
        isPending={isPending}
        onOpenChange={(next) => {
          setConversionDialogOpen(next);
          if (!next) setConversionKind(null);
        }}
        onConfirm={handleConfirmConversion}
      />
    </>
  );
}
