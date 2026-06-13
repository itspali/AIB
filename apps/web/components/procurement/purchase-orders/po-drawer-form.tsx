"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { Copy, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  issuePurchaseOrder,
  loadPurchaseOrderDetail,
  savePurchaseOrder,
  updatePurchaseOrderVoucherNumber,
  applyPoCatalogWriteback,
} from "@/app/procurement/purchase-orders/actions";
import { PoDocumentEditorShell } from "@/components/procurement/purchase-orders/po-document-editor-shell";
import { PoCatalogWritebackDialog } from "@/components/procurement/purchase-orders/po-catalog-writeback-dialog";
import { PoPeekView } from "@/components/procurement/purchase-orders/po-peek-view";
import { PoVoucherNumberField } from "@/components/procurement/purchase-orders/po-voucher-number-field";
import {
  RightDrawer,
  useRightDrawerLayout,
  type RightDrawerLayoutValue,
} from "@/components/ui/right-drawer";
import { UserFacingErrorMessage } from "@/components/ui/user-facing-error-message";
import type { UserFacingErrorAction } from "@/lib/errors/user-facing-error";
import { Button } from "@/components/ui/button";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import { isMutationSurface, type DrawerSurface } from "@/lib/layout/module-drawer-url";
import { PROCUREMENT_GRN_HREF, GRN_DRAWER_PO_PARAM } from "@/lib/procurement/navigation";
import { canEditPurchaseOrderDocument } from "@/lib/procurement/access";
import {
  defaultPoDraftForm,
  filterSavablePoLines,
  copyPoDraftFromOrder,
  mapPurchaseOrderToDraft,
  type PoDraftFormState,
} from "@/lib/procurement/purchase-orders/draft-form";
import { resolvePoHeaderChargesForSave } from "@/lib/procurement/purchase-orders/totals";
import { normalizePoLineDiscountForSave } from "@/lib/procurement/purchase-orders/po-line-discount";
import { resolvePoDraftLineUomCodeForSave } from "@/lib/procurement/purchase-orders/po-line-unit";
import { resolvePoGstContextFromForm } from "@/lib/procurement/purchase-orders/po-tax-supply";
import type { PoAutoRoundOffPolicy } from "@/lib/procurement/purchase-orders/po-auto-round-off";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";
import { useLivePoDocumentLayout } from "@/lib/documents/use-live-po-document-layout";
import { usePoDrawerFormLayout } from "@/lib/procurement/purchase-orders/use-po-drawer-form-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { OrganizationBillToSnapshot } from "@/lib/procurement/purchase-orders/organization-bill-to";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import {
  assignPromoGroups,
  resolvePromoParentForSave,
  validatePoPromoLines,
} from "@/lib/procurement/purchase-orders/po-promo";
import { buildPoCatalogWritebackRows } from "@/lib/procurement/purchase-orders/po-catalog-writeback";
import type { PoCatalogWritebackRow } from "@/lib/procurement/purchase-orders/po-catalog-writeback";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import { DocumentPostingSummaryPanel } from "@/components/documents/document-posting-summary-panel";
import type { PostingStepResult } from "@/lib/documents/posting-types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  surface: DrawerSurface;
  locations: ProcurementLocationOption[];
  suppliers: ProcurementSupplierOption[];
  peekOrder: PurchaseOrderRow | null;
  /** URL record id when peeking before the list row is refreshed. */
  peekRecordId: string | null;
  editOrderId: string | null;
  onClose: () => void;
  onAfterSave: (purchaseOrderId: string) => void;
  onOpenEdit: (purchaseOrderId: string) => void;
  onEditNotAllowed: (purchaseOrderId: string) => void;
  editAccessGranted: boolean;
  allowEditIssuedPurchaseOrders: boolean;
  allowLineItemDiscounts: boolean;
  allowTransactionDiscounts?: boolean;
  enableMrpTradeTerms?: boolean;
  promoDefaultCategory?: string;
  autoRoundOffPolicy?: PoAutoRoundOffPolicy;
  defaultPricesTaxInclusive: boolean;
  defaultCurrency: string;
  documentLayout: DocumentLayoutTemplate;
  preferredDestinationLocationId?: string | null;
  organizationBillTo: OrganizationBillToSnapshot;
  copyFromId?: string | null;
  onDuplicate?: (purchaseOrderId: string) => void;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
};

function resolveDrawerTitle(surface: DrawerSurface, order: PurchaseOrderRow | null): string {
  if (surface === "create") return "New purchase order";
  return order?.voucher_number ?? "Purchase order";
}

/** Syncs drawer width from inside RightDrawerLayoutProvider to PoDrawerForm (parent of RightDrawer). */
function PoDrawerLayoutBridge({
  onLayout,
}: {
  onLayout: (layout: RightDrawerLayoutValue) => void;
}) {
  const layout = useRightDrawerLayout();
  useEffect(() => {
    if (layout) onLayout(layout);
  }, [layout, onLayout]);
  return null;
}

export function PoDrawerForm({
  open,
  surface,
  locations,
  suppliers,
  peekOrder,
  peekRecordId,
  editOrderId,
  onClose,
  onAfterSave,
  onOpenEdit,
  onEditNotAllowed,
  editAccessGranted,
  allowEditIssuedPurchaseOrders,
  allowLineItemDiscounts,
  allowTransactionDiscounts = false,
  enableMrpTradeTerms = true,
  promoDefaultCategory = "FREE_GOODS",
  autoRoundOffPolicy,
  defaultPricesTaxInclusive,
  defaultCurrency,
  documentLayout: documentLayoutProp,
  preferredDestinationLocationId = null,
  organizationBillTo,
  copyFromId = null,
  onDuplicate,
  taxCodeOptions = [],
}: Props) {
  const readOnly = surface === "peek";
  const isMutating = isMutationSurface(surface);
  const [drawerLayoutSnapshot, setDrawerLayoutSnapshot] =
    useState<RightDrawerLayoutValue | null>(null);
  const handleDrawerLayout = useCallback((layout: RightDrawerLayoutValue) => {
    setDrawerLayoutSnapshot((prev) =>
      prev?.widthVw === layout.widthVw &&
      prev?.isPartialDrawer === layout.isPartialDrawer
        ? prev
        : layout
    );
  }, []);
  const { lineTableFillHeight, useDrawerBodyScroll } = usePoDrawerFormLayout(
    isMutating,
    drawerLayoutSnapshot
  );
  const resolvedPeekRecordId =
    surface === "peek" ? (peekOrder?.id ?? peekRecordId) : null;
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating,
  });

  useEffect(() => {
    if (!open) setDrawerLayoutSnapshot(null);
  }, [open]);

  const entryLineKey = useId();
  const [form, setForm] = useState<PoDraftFormState>(() =>
    defaultPoDraftForm(
      locations,
      suppliers,
      defaultCurrency,
      preferredDestinationLocationId,
      entryLineKey,
      defaultPricesTaxInclusive
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<UserFacingErrorAction | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState<PurchaseOrderRow | null>(peekOrder);
  const [detailLoading, setDetailLoading] = useState(false);
  const [issuePostingSummary, setIssuePostingSummary] = useState<PostingStepResult[] | null>(
    null
  );
  const [writebackOpen, setWritebackOpen] = useState(false);
  const [writebackLines, setWritebackLines] = useState<PoDraftLine[]>([]);
  const [writebackPendingOrderId, setWritebackPendingOrderId] = useState<string | null>(null);
  const submitRef = useRef<() => void>(() => {});

  const documentLayout = useLivePoDocumentLayout(documentLayoutProp, {
    refreshWhen: open,
    documentLocationId: isMutating
      ? form.destination_location_id
      : detail?.destination_location_id ?? peekOrder?.destination_location_id ?? null,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setErrorAction(null);
    setIsDirty(false);
    if (surface === "create") {
      if (!copyFromId) {
        setForm(
          defaultPoDraftForm(
            locations,
            suppliers,
            defaultCurrency,
            preferredDestinationLocationId,
            entryLineKey,
            defaultPricesTaxInclusive
          )
        );
        setDetail(null);
      }
    } else if (surface !== "peek") {
      setForm(
        defaultPoDraftForm(
          locations,
          suppliers,
          defaultCurrency,
          preferredDestinationLocationId,
          entryLineKey,
          defaultPricesTaxInclusive
        )
      );
      setDetail(peekOrder);
    } else if (peekOrder?.lines?.length) {
      setDetail(peekOrder);
    }
  }, [
    copyFromId,
    open,
    surface,
    peekOrder?.id,
    peekOrder?.lines?.length,
    locations,
    suppliers,
    defaultCurrency,
    preferredDestinationLocationId,
    entryLineKey,
    defaultPricesTaxInclusive,
  ]);

  useEffect(() => {
    if (!open || surface !== "create" || !copyFromId) return;

    let cancelled = false;
    setDetailLoading(true);
    void loadPurchaseOrderDetail(copyFromId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to duplicate purchase order.");
        setError(result.error);
        setForm(
          defaultPoDraftForm(
            locations,
            suppliers,
            defaultCurrency,
            preferredDestinationLocationId,
            entryLineKey,
            defaultPricesTaxInclusive
          )
        );
        return;
      }
      setForm(copyPoDraftFromOrder(result.purchaseOrder));
      setIsDirty(true);
    });

    return () => {
      cancelled = true;
    };
  }, [
    copyFromId,
    defaultCurrency,
    locations,
    open,
    preferredDestinationLocationId,
    suppliers,
    surface,
  ]);

  useEffect(() => {
    if (!open || surface !== "peek" || !resolvedPeekRecordId) return;
    if (peekOrder?.lines?.length) {
      setDetail(peekOrder);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void loadPurchaseOrderDetail(resolvedPeekRecordId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDetail(result.purchaseOrder);
    });

    return () => {
      cancelled = true;
    };
  }, [open, resolvedPeekRecordId, surface, peekOrder?.lines?.length]);

  useEffect(() => {
    if (!open || surface !== "edit" || !editOrderId) return;

    let cancelled = false;
    setDetailLoading(true);
    void loadPurchaseOrderDetail(editOrderId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDetail(result.purchaseOrder);
      setForm(mapPurchaseOrderToDraft(result.purchaseOrder));
      setIsDirty(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, surface, editOrderId]);

  const canEditThisOrder =
    detail != null
      ? canEditPurchaseOrderDocument(detail.document_status, {
          allowEditIssued: allowEditIssuedPurchaseOrders,
          hasEditPermission: editAccessGranted,
        })
      : editAccessGranted;

  useEffect(() => {
    if (!open || surface !== "edit" || detailLoading || !detail?.id) return;
    if (!canEditThisOrder) {
      onEditNotAllowed(detail.id);
    }
  }, [canEditThisOrder, detail?.id, detailLoading, onEditNotAllowed, open, surface]);

  const patchForm = useCallback((next: Partial<PoDraftFormState>) => {
    setForm((current) => ({ ...current, ...next }));
    setIsDirty(true);
  }, []);

  const finishSaveFlow = useCallback(
    (purchaseOrderId: string) => {
      onAfterSave(purchaseOrderId);
    },
    [onAfterSave]
  );

  const maybePromptCatalogWriteback = useCallback(
    (lines: PoDraftLine[], purchaseOrderId: string) => {
      if (buildPoCatalogWritebackRows(lines).length === 0) {
        finishSaveFlow(purchaseOrderId);
        return;
      }
      setWritebackLines(lines);
      setWritebackPendingOrderId(purchaseOrderId);
      setWritebackOpen(true);
    },
    [finishSaveFlow]
  );

  const handleWritebackSkip = useCallback(() => {
    setWritebackOpen(false);
    const orderId = writebackPendingOrderId;
    setWritebackPendingOrderId(null);
    if (orderId) finishSaveFlow(orderId);
  }, [finishSaveFlow, writebackPendingOrderId]);

  const handleWritebackApply = useCallback(
    (selectedRows: PoCatalogWritebackRow[]) => {
      startTransition(async () => {
        const result = await applyPoCatalogWriteback({
          supplier_id: form.supplier_id,
          updates: selectedRows.map((row) => ({
            item_id: row.itemId,
            variant_id: row.variantId,
            field: row.field,
            value: row.proposedValue,
          })),
        });
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success(
          result.updatedCount > 0
            ? `Updated ${result.updatedCount} catalog record(s).`
            : "Catalog update completed."
        );
        setWritebackOpen(false);
        const orderId = writebackPendingOrderId;
        setWritebackPendingOrderId(null);
        if (orderId) finishSaveFlow(orderId);
      });
    },
    [finishSaveFlow, form.supplier_id, writebackPendingOrderId]
  );

  const closeForm = useCallback(() => {
    setError(null);
    setErrorAction(null);
    setIsDirty(false);
    onClose();
  }, [onClose]);

  const handleRequestClose = useCallback(() => {
    if (isMutating && isDirty) {
      requestClose(closeForm);
      return;
    }
    closeForm();
  }, [closeForm, isDirty, isMutating, requestClose]);

  const handleSaveDraft = useCallback(() => {
    setError(null);
    setErrorAction(null);
    startTransition(async () => {
      const savableLines = assignPromoGroups(filterSavablePoLines(form.lines));
      const promoError = validatePoPromoLines(savableLines);
      if (promoError) {
        setError(promoError);
        return;
      }
      const lineKeyToVariant = new Map(savableLines.map((line) => [line.key, line]));
      const taxMechanism = resolvePoGstContextFromForm(
        suppliers,
        form.supplier_id,
        locations,
        form.destination_location_id,
        organizationBillTo?.country_code ?? null
      ).taxMechanism;
      const headerCharges = resolvePoHeaderChargesForSave(form.header_charges, savableLines, {
        purchasePricesTaxInclusive: form.prices_tax_inclusive,
        taxMechanism,
        headerCharges: form.header_charges,
        autoRoundOff: autoRoundOffPolicy,
        allowTransactionDiscounts,
      });
      const payload = {
        purchase_order_id: editOrderId ?? detail?.id ?? null,
        destination_location_id: form.destination_location_id,
        supplier_id: form.supplier_id,
        currency_code: form.currency_code,
        payment_terms_days: form.payment_terms_days,
        prices_tax_inclusive: form.prices_tax_inclusive,
        custom_fields: form.custom_fields,
        shipping_amount: String(headerCharges.shipping_amount),
        shipping_tax_rate_pct: String(headerCharges.shipping_tax_rate_pct),
        shipping_tax_amount: String(headerCharges.shipping_tax_amount),
        shipping_tax_type: headerCharges.shipping_tax_type,
        round_off_amount: String(headerCharges.round_off_amount),
        additional_charges_amount: String(headerCharges.additional_charges_amount),
        transaction_discount_percentage: String(headerCharges.transaction_discount_percentage),
        transaction_discount_amount: String(headerCharges.transaction_discount_amount),
        transaction_discount_type: headerCharges.transaction_discount_type,
        lines: savableLines.map((line) => {
          const discount = normalizePoLineDiscountForSave(line);
          const parentKey = line.linked_parent_line_key;
          const parent = parentKey ? lineKeyToVariant.get(parentKey) : null;
          const promoParent = resolvePromoParentForSave(line, parent);
          return {
            variant_id: line.variant_id,
            quantity_ordered: line.quantity_ordered,
            unit_price_contractual: line.unit_price_contractual || "0",
            discount_percentage: discount.discount_percentage,
            discount_amount: discount.discount_amount,
            uom_code: resolvePoDraftLineUomCodeForSave(line),
            ...(Number(line.unit_price_contractual) === 0 || line.is_promotional
              ? {
                  is_promotional: true,
                  promo_group_id: line.promo_group_id ?? undefined,
                  promotional_category: line.promotional_category ?? promoDefaultCategory,
                  ...promoParent,
                }
              : {}),
          };
        }),
      };

      const result = await savePurchaseOrder(payload);
      if ("error" in result) {
        setError(result.error ?? "Unable to save purchase order.");
        setErrorAction(result.errorAction ?? null);
        return;
      }

      toast.success("Purchase order saved");
      setIsDirty(false);
      maybePromptCatalogWriteback(savableLines, result.purchaseOrderId);
    });
  }, [autoRoundOffPolicy, detail?.id, detail?.lines, editOrderId, form, locations, maybePromptCatalogWriteback, organizationBillTo?.country_code, promoDefaultCategory, suppliers]);

  const handleIssue = useCallback(() => {
    const orderId = editOrderId ?? detail?.id;
    if (!orderId) return;

    setError(null);
    setErrorAction(null);
    startTransition(async () => {
      const result = await issuePurchaseOrder({ purchase_order_id: orderId });
      if ("error" in result) {
        setError(result.error ?? "Unable to issue purchase order.");
        setErrorAction(result.errorAction ?? null);
        return;
      }

      toast.success("Purchase order issued");
      setIssuePostingSummary(result.steps ?? []);
      setIsDirty(false);
      onAfterSave(result.purchaseOrderId);
    });
  }, [detail?.id, editOrderId, onAfterSave]);

  submitRef.current = handleSaveDraft;

  useEffect(() => {
    if (!open || !isMutating) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        submitRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMutating, open]);

  const canReceive =
    detail?.document_status === "ISSUED_ACTIVE" ||
    detail?.document_status === "PARTIALLY_FULFILLED";

  const isDraftOrder = detail?.document_status === "DRAFT";
  const saveActionLabel = isDraftOrder ? "Save draft" : "Save";
  const purchaseOrderId = editOrderId ?? detail?.id ?? null;
  const canEditVoucherNumber =
    isDraftOrder && canEditThisOrder && purchaseOrderId != null;

  const handleSaveVoucherNumber = useCallback(
    async (next: string) => {
      if (!purchaseOrderId) {
        return { error: "Save the purchase order before changing the PO number." };
      }

      const result = await updatePurchaseOrderVoucherNumber({
        purchase_order_id: purchaseOrderId,
        voucher_number: next,
      });

      if ("error" in result) {
        return { error: result.error ?? "Unable to save PO number." };
      }

      setDetail((current) =>
        current ? { ...current, voucher_number: result.voucherNumber } : current
      );
      toast.success("PO number updated");
      return {};
    },
    [purchaseOrderId]
  );

  const headerActions =
    surface === "peek" && detail ? (
      <>
        {canEditThisOrder ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Edit purchase order"
              onClick={() => onOpenEdit(detail.id)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {isDraftOrder ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={handleIssue}
              >
                {isPending ? "Issuing…" : "Issue"}
              </Button>
            ) : null}
          </>
        ) : null}
        {canReceive ? (
          <Button type="button" size="sm" asChild>
            <Link
              href={`${PROCUREMENT_GRN_HREF}?action=new&${GRN_DRAWER_PO_PARAM}=${detail.id}`}
            >
              Receive
            </Link>
          </Button>
        ) : null}
        {editAccessGranted && onDuplicate ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onDuplicate(detail.id)}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Duplicate
          </Button>
        ) : null}
      </>
    ) : isMutating ? (
      <>
        <Button
          type="button"
          size="sm"
          disabled={isPending || locations.length === 0 || suppliers.length === 0}
          onClick={handleSaveDraft}
          title={`${saveActionLabel} (Ctrl+Enter)`}
        >
          {isPending ? "Saving…" : saveActionLabel}
        </Button>
        {isDraftOrder && (editOrderId ?? detail?.id) ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={handleIssue}
          >
            Issue
          </Button>
        ) : null}
      </>
    ) : null;

  if (!open || surface === "closed") return discardDialog;

  const detailReadyForPeek = detail?.id === resolvedPeekRecordId;
  const showLoadingPeek =
    surface === "peek" &&
    resolvedPeekRecordId != null &&
    (detailLoading || !detailReadyForPeek);
  const showLoadingEdit = surface === "edit" && detailLoading;
  const assignedVoucherNumber = detail?.voucher_number ?? null;
  const drawerTitle =
    isMutating && assignedVoucherNumber
      ? assignedVoucherNumber
      : resolveDrawerTitle(surface, detail);
  const drawerTitleContent =
    isMutating && assignedVoucherNumber ? (
      <PoVoucherNumberField
        variant="header"
        value={assignedVoucherNumber}
        canEdit={canEditVoucherNumber}
        disabled={isPending}
        onSave={handleSaveVoucherNumber}
      />
    ) : undefined;

  const errorBanner = error ? (
    <UserFacingErrorMessage
      message={error}
      action={errorAction ?? undefined}
      className="mb-4 shrink-0"
    />
  ) : null;

  const loadingMessage =
    showLoadingPeek || showLoadingEdit ? (
      <p className="text-sm text-muted-foreground">Loading purchase order…</p>
    ) : null;

  const mutatingForm =
    isMutating && !showLoadingPeek && !showLoadingEdit ? (
      <PoDocumentEditorShell
        form={form}
        locations={locations}
        suppliers={suppliers}
        editOrderId={editOrderId ?? detail?.id ?? null}
        defaultCurrency={defaultCurrency}
        documentLayout={documentLayout}
        allowLineItemDiscounts={allowLineItemDiscounts}
        allowTransactionDiscounts={allowTransactionDiscounts}
        enableMrpTradeTerms={enableMrpTradeTerms}
        promoDefaultCategory={promoDefaultCategory}
        autoRoundOffPolicy={autoRoundOffPolicy}
        taxCodeOptions={taxCodeOptions}
        tenantCountry={organizationBillTo?.country_code ?? null}
        isPending={isPending}
        layoutOverride={drawerLayoutSnapshot}
        onPatch={patchForm}
        onLinesChange={(linesOrUpdater) => {
          setForm((current) => ({
            ...current,
            lines:
              typeof linesOrUpdater === "function"
                ? linesOrUpdater(current.lines)
                : linesOrUpdater,
          }));
          setIsDirty(true);
        }}
      />
    ) : null;

  const drawerBody = (
    <>
      <PoDrawerLayoutBridge onLayout={handleDrawerLayout} />
      {errorBanner}
      {loadingMessage}
      {readOnly && detail ? (
        <PoPeekView
          order={detail}
          layout={documentLayout}
          organizationBillTo={organizationBillTo}
        />
      ) : null}
      {mutatingForm}
      {issuePostingSummary?.length ? (
        <DocumentPostingSummaryPanel steps={issuePostingSummary} overall="success" className="mt-4" />
      ) : null}
    </>
  );

  return (
    <>
      <PoCatalogWritebackDialog
        open={writebackOpen}
        lines={writebackLines}
        isPending={isPending}
        onOpenChange={(next) => {
          if (!next) handleWritebackSkip();
          else setWritebackOpen(true);
        }}
        onApply={handleWritebackApply}
        onSkip={handleWritebackSkip}
      />
      <RightDrawer
        open={open}
        onOpenChange={(next) => {
          if (next) return;
          handleRequestClose();
        }}
        onRequestClose={handleRequestClose}
        title={drawerTitle}
        titleContent={drawerTitleContent}
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
        <div
          className={cn(
            "flex flex-col",
            isMutating && lineTableFillHeight && "min-h-0 flex-1 overflow-hidden",
            isMutating && useDrawerBodyScroll && "shrink-0 pb-6"
          )}
        >
          {drawerBody}
        </div>
      </RightDrawer>
      {discardDialog}
    </>
  );
}
