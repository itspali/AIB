"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { Copy, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  approvePurchaseOrder,
  issuePurchaseOrder,
  loadPurchaseOrderDetail,
  rejectPurchaseOrder,
  savePurchaseOrder,
  submitPurchaseOrderForApproval,
  updatePurchaseOrderVoucherNumber,
  applyPoCatalogWriteback,
} from "@/app/procurement/purchase-orders/actions";
import { PoDocumentEditorShell } from "@/components/procurement/purchase-orders/po-document-editor-shell";
import { PoCatalogWritebackDialog } from "@/components/procurement/purchase-orders/po-catalog-writeback-dialog";
import { PoPeekView } from "@/components/procurement/purchase-orders/po-peek-view";
import { PoPeekViewSkeleton } from "@/components/procurement/purchase-orders/po-peek-view-skeleton";
import { poPeekShowsPromoEntitlements } from "@/lib/procurement/purchase-orders/po-peek-promo";
import { fetchPurchaseOrderPeek } from "@/lib/procurement/purchase-orders/fetch-purchase-order-peek";
import type { PoPromoEntitlementRow } from "@/lib/procurement/promo/entitlements";
import { DocumentPrintButton } from "@/components/documents/document-print-button";
import { PoVoucherNumberField } from "@/components/procurement/purchase-orders/po-voucher-number-field";
import {
  RightDrawer,
  useRightDrawerLayout,
  type RightDrawerLayoutValue,
} from "@/components/ui/right-drawer";
import { UserFacingErrorMessage } from "@/components/ui/user-facing-error-message";
import type { UserFacingErrorAction } from "@/lib/errors/user-facing-error";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import { isMutationSurface, type DrawerSurface } from "@/lib/layout/module-drawer-url";
import { useModuleDrawerPeekPresentation } from "@/lib/layout/use-module-drawer-peek-presentation";
import { notifyApprovalAlertChanged } from "@/lib/layout/approval-alert-events";
import { PROCUREMENT_GRN_HREF, GRN_DRAWER_PO_PARAM, importShipmentCreateFromPoHref } from "@/lib/procurement/navigation";
import { useOnboardingContext } from "@/components/onboarding/onboarding-context";
import { canEditPurchaseOrderDocument } from "@/lib/procurement/access";
import { applySavedPoTaxToDraftForm } from "@/lib/procurement/purchase-orders/po-line-saved-tax";
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
import { setCachedPoDocumentLayout } from "@/lib/documents/po-document-layout-cache";
import { usePoDrawerFormLayout } from "@/lib/procurement/purchase-orders/use-po-drawer-form-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { OrganizationBillToSnapshot } from "@/lib/procurement/purchase-orders/organization-bill-to";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import {
  assignPromoGroups,
  resolvePromoParentForSave,
  validatePoPromoLines,
} from "@/lib/procurement/purchase-orders/po-promo";
import {
  isOrganizationGstRegistered,
  validatePoGstComplianceLines,
} from "@/lib/procurement/purchase-orders/po-gst-compliance";
import { buildPoCatalogWritebackRows } from "@/lib/procurement/purchase-orders/po-catalog-writeback";
import type { PoCatalogWritebackRow } from "@/lib/procurement/purchase-orders/po-catalog-writeback";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import { DocumentPostingSummaryPanel } from "@/components/documents/document-posting-summary-panel";
import { DocumentPeekActivityShell } from "@/components/activity/document-peek-activity-shell";
import { DocumentPeekApprovalPane } from "@/components/approvals/document-peek-approval-pane";
import type { PostingStepResult } from "@/lib/documents/posting-types";
import {
  canUserManuallyIssueApprovedPo,
  isPoApprovalRequiredBeforeIssue,
  isPoFullyApprovedAwaitingIssue,
  isPurchaseOrderApprovableByUser,
  type ProcurementApprovalSettings,
} from "@/lib/procurement/approval-settings";
import { computePurchaseOrderTotals } from "@/lib/procurement/purchase-orders/totals";
import { cn } from "@/lib/utils";
import { useDelayedVisible } from "@/hooks/use-delayed-visible";
import type { PoFulfillmentStage } from "@/lib/procurement/import-logistics-settings-shared";
import { loadSubcontractWipSupplierIds } from "@/app/(workspace)/procurement/subcontract/actions";

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
  approvalSettings: ProcurementApprovalSettings;
  currentUserId: string;
  isOwner: boolean;
  tenantDefaultFulfillmentStage?: PoFulfillmentStage;
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
  approvalSettings,
  currentUserId,
  isOwner,
  tenantDefaultFulfillmentStage = "COMMERCIAL",
}: Props) {
  const readOnly = surface === "peek";
  const isMutating = isMutationSurface(surface);
  const { isSplitInlinePeek, peekShellClassName, peekBodyClassName } =
    useModuleDrawerPeekPresentation(surface === "peek");
  const { importsEnabled } = useOnboardingContext();
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
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [peekPromoEntitlements, setPeekPromoEntitlements] = useState<
    PoPromoEntitlementRow[] | null
  >(null);
  const [subcontractWipSupplierIds, setSubcontractWipSupplierIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    void loadSubcontractWipSupplierIds().then(setSubcontractWipSupplierIds).catch(() => {
      setSubcontractWipSupplierIds([]);
    });
  }, [open]);
  const [peekPromoLoadError, setPeekPromoLoadError] = useState<string | null>(null);
  const [peekDocumentLayout, setPeekDocumentLayout] = useState<DocumentLayoutTemplate | null>(
    null
  );
  const submitRef = useRef<() => void>(() => {});

  const resolvedDocumentLocationId = isMutating
    ? form.destination_location_id?.trim() || null
    : peekOrder?.destination_location_id?.trim() ??
      detail?.destination_location_id?.trim() ??
      null;
  const awaitingDocumentLocation =
    !isMutating &&
    !resolvedDocumentLocationId &&
    Boolean(resolvedPeekRecordId ?? editOrderId);

  const { layout: liveDocumentLayout } = useLivePoDocumentLayout(
    documentLayoutProp,
    {
      refreshWhen: open && !awaitingDocumentLocation && surface !== "peek",
      documentLocationId: resolvedDocumentLocationId,
    }
  );
  const documentLayout =
    surface === "peek" && peekDocumentLayout ? peekDocumentLayout : liveDocumentLayout;

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
      setForm(applySavedPoTaxToDraftForm(copyPoDraftFromOrder(result.purchaseOrder), taxCodeOptions));
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
    taxCodeOptions,
  ]);

  useEffect(() => {
    if (!open || surface !== "peek" || !resolvedPeekRecordId) return;
    if (peekOrder?.lines?.length) {
      setDetail(peekOrder);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setPeekDocumentLayout(null);
    setPeekPromoEntitlements(null);
    setPeekPromoLoadError(null);
    void fetchPurchaseOrderPeek(resolvedPeekRecordId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setCachedPoDocumentLayout(
        result.purchaseOrder.destination_location_id,
        result.documentLayout
      );
      setPeekDocumentLayout(result.documentLayout);
      setDetail(result.purchaseOrder);
      setPeekPromoEntitlements(result.promoEntitlements);
      setPeekPromoLoadError(null);
    });

    return () => {
      cancelled = true;
    };
  }, [open, resolvedPeekRecordId, surface, peekOrder?.document_status, peekOrder?.lines?.length]);

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
      setForm(
        applySavedPoTaxToDraftForm(mapPurchaseOrderToDraft(result.purchaseOrder), taxCodeOptions)
      );
      setIsDirty(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, surface, editOrderId, taxCodeOptions]);

  const peekPromoStatus = detail?.document_status ?? peekOrder?.document_status;
  const peekNeedsPromoEntitlements = poPeekShowsPromoEntitlements(peekPromoStatus);

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

  const reloadDetail = useCallback(async (orderId: string) => {
    const result = await loadPurchaseOrderDetail(orderId);
    if ("error" in result) return;
    setDetail(result.purchaseOrder);
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
            value: row.applyValue ?? row.proposedValue,
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
      const gstRegistered = isOrganizationGstRegistered(organizationBillTo);
      const gstContext = resolvePoGstContextFromForm(
        suppliers,
        form.supplier_id,
        locations,
        form.destination_location_id,
        organizationBillTo?.country_code ?? null
      );
      const gstComplianceError = validatePoGstComplianceLines(savableLines, gstRegistered, {
        supplyNature: gstContext.supplyNature,
      });
      if (gstComplianceError) {
        setError(gstComplianceError);
        return;
      }
      const lineKeyToVariant = new Map(savableLines.map((line) => [line.key, line]));
      const taxMechanism = gstContext.taxMechanism;
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
        receipt_location_id: form.receipt_location_id?.trim() || "",
        ultimate_destination_location_id:
          form.ultimate_destination_location_id?.trim() ||
          form.destination_location_id,
        po_fulfillment_stage_override: form.po_fulfillment_stage_override || "",
        is_subcontract_job: form.is_subcontract_job,
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
  }, [autoRoundOffPolicy, detail?.id, detail?.lines, editOrderId, form, locations, maybePromptCatalogWriteback, organizationBillTo, promoDefaultCategory, suppliers]);

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
      await reloadDetail(orderId);
      onAfterSave(result.purchaseOrderId);
    });
  }, [detail?.id, editOrderId, onAfterSave, reloadDetail]);

  const handleSubmitForApproval = useCallback(() => {
    const orderId = editOrderId ?? detail?.id;
    if (!orderId) return;

    setError(null);
    setErrorAction(null);
    startTransition(async () => {
      const result = await submitPurchaseOrderForApproval({ purchase_order_id: orderId });
      if ("error" in result) {
        setError(result.error ?? "Unable to submit purchase order for approval.");
        setErrorAction(result.errorAction ?? null);
        return;
      }

      toast.success("Purchase order submitted for approval");
      setIssuePostingSummary(result.steps ?? []);
      setIsDirty(false);
      await reloadDetail(orderId);
      onAfterSave(result.purchaseOrderId);
      notifyApprovalAlertChanged();
    });
  }, [detail?.id, editOrderId, onAfterSave, reloadDetail]);

  const handleApprove = useCallback(() => {
    const orderId = editOrderId ?? detail?.id;
    if (!orderId) return;

    setError(null);
    setErrorAction(null);
    startTransition(async () => {
      const result = await approvePurchaseOrder({ purchase_order_id: orderId });
      if ("error" in result) {
        setError(result.error ?? "Unable to approve purchase order.");
        setErrorAction(result.errorAction ?? null);
        return;
      }

      toast.success(
        result.pendingNextStep
          ? "Step approved — waiting for next level."
          : result.issued
            ? "Purchase order approved and issued"
            : "Purchase order approved — ready to issue"
      );
      setIssuePostingSummary(result.steps ?? []);
      setIsDirty(false);
      await reloadDetail(orderId);
      onAfterSave(result.purchaseOrderId);
      notifyApprovalAlertChanged();
    });
  }, [detail?.id, editOrderId, onAfterSave, reloadDetail]);

  const handleReject = useCallback(() => {
    const orderId = editOrderId ?? detail?.id;
    if (!orderId) return;

    const notes = rejectNotes.trim();
    if (!notes) {
      toast.error("Enter a rejection reason.");
      return;
    }

    setError(null);
    setErrorAction(null);
    startTransition(async () => {
      const result = await rejectPurchaseOrder({
        purchase_order_id: orderId,
        notes,
      });
      if ("error" in result) {
        setError(result.error ?? "Unable to reject purchase order.");
        setErrorAction(result.errorAction ?? null);
        return;
      }

      toast.success("Purchase order rejected");
      setRejectDialogOpen(false);
      setRejectNotes("");
      setIssuePostingSummary(result.steps ?? []);
      setIsDirty(false);
      await reloadDetail(orderId);
      onAfterSave(result.purchaseOrderId);
      notifyApprovalAlertChanged();
    });
  }, [detail?.id, editOrderId, onAfterSave, rejectNotes, reloadDetail]);

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
  const canCreateImportShipment =
    canReceive && importsEnabled && detail?.tax_supply_nature === "IMPORT_GOODS";

  const isDraftOrder = detail?.document_status === "DRAFT";
  const isPendingApprovalOrder =
    detail?.document_status === "PENDING_APPROVAL" &&
    detail != null &&
    !isPoFullyApprovedAwaitingIssue(detail);
  const purchaseOrderId = editOrderId ?? detail?.id ?? null;
  const savedTotalNetAmount = Number(detail?.total_net_amount ?? 0);
  const totalNetAmount = (() => {
    if (!isMutating) return savedTotalNetAmount;
    try {
      const savableLines = filterSavablePoLines(form.lines);
      const taxMechanism = resolvePoGstContextFromForm(
        suppliers,
        form.supplier_id,
        locations,
        form.destination_location_id,
        organizationBillTo.country_code
      ).taxMechanism;
      return computePurchaseOrderTotals(savableLines, {
        purchasePricesTaxInclusive: form.prices_tax_inclusive,
        taxMechanism,
        headerCharges: form.header_charges,
        autoRoundOff: autoRoundOffPolicy,
        allowTransactionDiscounts,
      }).grandTotal;
    } catch {
      return savedTotalNetAmount;
    }
  })();
  const approvalRequiredBeforeIssue = isPoApprovalRequiredBeforeIssue(
    approvalSettings,
    totalNetAmount,
    currentUserId,
    { isOwner }
  );
  const showSubmitForApproval =
    isDraftOrder && editAccessGranted && approvalRequiredBeforeIssue && purchaseOrderId != null;
  const showIssue =
    (isDraftOrder &&
      editAccessGranted &&
      !approvalRequiredBeforeIssue &&
      purchaseOrderId != null) ||
    (detail != null &&
      purchaseOrderId != null &&
      canUserManuallyIssueApprovedPo(detail, currentUserId, approvalSettings, {
        isOwner,
        editAccessGranted,
      }));
  const showApproveReject =
    isPendingApprovalOrder &&
    detail != null &&
    isPurchaseOrderApprovableByUser(detail, currentUserId, approvalSettings, { isOwner }) &&
    purchaseOrderId != null;

  const saveActionLabel = isDraftOrder ? "Save draft" : "Save";
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
        ) : null}
        {showSubmitForApproval ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={handleSubmitForApproval}
          >
            {isPending ? "Submitting…" : "Submit for approval"}
          </Button>
        ) : null}
        {showIssue ? (
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
        {showApproveReject ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isPending}
              onClick={handleApprove}
            >
              {isPending ? "Approving…" : "Approve"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setRejectDialogOpen(true)}
            >
              Reject
            </Button>
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
        {canCreateImportShipment ? (
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href={importShipmentCreateFromPoHref(detail.id)}>Create shipment</Link>
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
        <DocumentPrintButton
          moduleKey="PURCHASE_ORDER"
          documentId={detail.id}
          documentLocationId={detail.destination_location_id}
        />
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
        {showSubmitForApproval ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={handleSubmitForApproval}
          >
            {isPending ? "Submitting…" : "Submit for approval"}
          </Button>
        ) : null}
        {showIssue ? (
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

  const detailReadyForPeek =
    detail?.id === resolvedPeekRecordId && (surface !== "peek" || peekDocumentLayout != null);
  const showLoadingPeek =
    open &&
    surface === "peek" &&
    resolvedPeekRecordId != null &&
    (detailLoading || !detailReadyForPeek);
  const showLoadingPeekSkeleton = useDelayedVisible(showLoadingPeek);
  const showLoadingEdit = open && surface === "edit" && detailLoading;

  if (!open || surface === "closed") return discardDialog;

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
    showLoadingEdit ? (
      <p className="text-sm text-muted-foreground">Loading purchase order…</p>
    ) : null;

  const peekLoadingSkeleton =
    showLoadingPeek && showLoadingPeekSkeleton ? (
      <PoPeekViewSkeleton includePromoSection={peekNeedsPromoEntitlements} />
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
        tenantDefaultFulfillmentStage={tenantDefaultFulfillmentStage}
        subcontractWipSupplierIds={subcontractWipSupplierIds}
        organizationBillTo={organizationBillTo}
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
      {peekLoadingSkeleton}
      {readOnly && detail && !showLoadingPeek ? (
        <>
          <DocumentPeekActivityShell
            entityType="PURCHASE_ORDER"
            entityId={detail.id}
            refreshKey={`${detail.id}:${detail.updated_at}:${issuePostingSummary?.length ?? 0}`}
            showApprovalPane={Boolean(detail.id)}
            approvalPane={
              <DocumentPeekApprovalPane
                documentType="PURCHASE_ORDER"
                documentId={detail.id}
                documentStatus={detail.document_status}
                voucherNumber={detail.voucher_number}
                totalNetAmount={Number(detail.total_net_amount ?? 0)}
                currencyCode={detail.currency_code}
                approvalSubmittedBy={detail.approval_submitted_by}
                approvalRequestStatus={detail.approval_request_status}
                approvalRunStatus={detail.approval_run_status}
                currentUserId={currentUserId}
                isOwner={isOwner}
                approvalSettings={approvalSettings}
                refreshKey={`${detail.id}:${detail.updated_at}:${detail.approval_request_status ?? ""}:${detail.approval_run_status ?? ""}:${issuePostingSummary?.length ?? 0}`}
                onActionComplete={async () => {
                  await reloadDetail(detail.id);
                  onAfterSave(detail.id);
                }}
              />
            }
          >
            <PoPeekView
              order={detail}
              layout={documentLayout}
              organizationBillTo={organizationBillTo}
              enableMrpTradeTerms={enableMrpTradeTerms}
              promoEntitlements={peekPromoEntitlements ?? []}
              promoLoadError={peekPromoLoadError}
            />
          </DocumentPeekActivityShell>
        </>
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
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject purchase order</AlertDialogTitle>
            <AlertDialogDescription>
              The order will return to Draft. Enter a reason the submitter can act on.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            className="glass-form-control min-h-[96px] w-full"
            placeholder="Rejection reason"
            value={rejectNotes}
            onChange={(event) => setRejectNotes(event.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={isPending} onClick={handleReject}>
              {isPending ? "Rejecting…" : "Reject order"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <RightDrawer
        open={open}
        onOpenChange={(next) => {
          if (next) return;
          handleRequestClose();
        }}
        onRequestClose={handleRequestClose}
        title={drawerTitle}
        description={
          surface === "peek" && detail?.supplier_name ? detail.supplier_name : undefined
        }
        titleContent={drawerTitleContent}
        headerActions={headerActions}
        widthPolicy={surface === "peek" ? "peek" : "document"}
        allowBackgroundInteraction={surface === "peek"}
        peekMode={surface === "peek"}
        className={peekShellClassName}
        bodyClassName={
          surface === "peek"
            ? peekBodyClassName
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
