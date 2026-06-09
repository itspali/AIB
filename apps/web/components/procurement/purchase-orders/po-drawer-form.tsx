"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  issuePurchaseOrder,
  loadPurchaseOrderDetail,
  savePurchaseOrder,
  updatePurchaseOrderVoucherNumber,
} from "@/app/procurement/purchase-orders/actions";
import { PoDetailsPanel } from "@/components/procurement/purchase-orders/po-details-panel";
import { PoFormHeader } from "@/components/procurement/purchase-orders/po-form-header";
import { PoLineEntryTable } from "@/components/procurement/purchase-orders/po-line-entry-table";
import { PoPeekView } from "@/components/procurement/purchase-orders/po-peek-view";
import { PoVoucherNumberField } from "@/components/procurement/purchase-orders/po-voucher-number-field";
import { PoTotalsPanel } from "@/components/procurement/purchase-orders/po-totals-panel";
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
  mapPurchaseOrderToDraft,
  type PoDraftFormState,
} from "@/lib/procurement/purchase-orders/draft-form";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";
import { cn } from "@/lib/utils";
import { usePoDocumentLayout } from "@/lib/documents/use-po-document-layout";
import { usePoDrawerFormLayout } from "@/lib/procurement/purchase-orders/use-po-drawer-form-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";

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
  defaultCurrency: string;
  documentLayout: DocumentLayoutTemplate;
  preferredDestinationLocationId?: string | null;
};

function resolveDrawerTitle(surface: DrawerSurface, order: PurchaseOrderRow | null): string {
  if (surface === "create") return "New purchase order";
  return order?.voucher_number ?? "Purchase order";
}

/** Flex column shell so the line grid can claim height and scroll internally. */
function poLinesTableSlotClass(fillHeight: boolean) {
  return cn(
    "min-h-0 min-w-0 max-w-full",
    fillHeight && "flex flex-1 flex-col"
  );
}

const PO_LINES_SECTION_LABEL = (
  <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    Lines
  </p>
);

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

type PoMutatingFormContentProps = {
  form: PoDraftFormState;
  locations: ProcurementLocationOption[];
  suppliers: ProcurementSupplierOption[];
  editOrderId: string | null;
  defaultCurrency: string;
  documentLayout: DocumentLayoutTemplate;
  isPending: boolean;
  onPatch: (patch: Partial<PoDraftFormState>) => void;
  onLinesChange: (
    linesOrUpdater: PoDraftFormState["lines"] | ((current: PoDraftFormState["lines"]) => PoDraftFormState["lines"])
  ) => void;
};

function PoMutatingFormContent({
  form,
  locations,
  suppliers,
  editOrderId,
  defaultCurrency,
  documentLayout,
  isPending,
  onPatch,
  onLinesChange,
}: PoMutatingFormContentProps) {
  const resolvedDocumentLayout = usePoDocumentLayout(documentLayout);
  const {
    useWidePartialDrawer,
    useFullPageLayout,
    lineTableFillHeight,
  } = usePoDrawerFormLayout(true);

  const linesTable = (
    <PoLineEntryTable
      fillHeight={lineTableFillHeight}
      showSectionTitle={false}
      lines={form.lines}
      supplierId={form.supplier_id}
      destinationLocationId={form.destination_location_id}
      excludePurchaseOrderId={editOrderId}
      disabled={isPending}
      layout={resolvedDocumentLayout}
      onChange={onLinesChange}
    />
  );

  const stackedSummaryDetails = (
    <>
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Summary
        </p>
        <PoTotalsPanel lines={form.lines} layout={resolvedDocumentLayout} layoutMode="embedded" />
      </div>
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Details
        </p>
        <PoDetailsPanel
          form={form}
          disabled={isPending}
          layout="stack"
          documentLayout={resolvedDocumentLayout}
          onPatch={onPatch}
        />
      </div>
    </>
  );

  const sideRail = (
    <aside className="flex w-full shrink-0 flex-col gap-4 lg:h-full lg:min-h-0 lg:w-[15rem] lg:max-h-full lg:max-w-[40%] lg:shrink-0 lg:overflow-hidden">
      <div className="shrink-0 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Summary
        </p>
        <PoTotalsPanel lines={form.lines} layout={resolvedDocumentLayout} layoutMode="embedded" />
      </div>
      <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
        <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Details
        </p>
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <PoDetailsPanel
            form={form}
            disabled={isPending}
            layout="rail"
            documentLayout={resolvedDocumentLayout}
            onPatch={onPatch}
          />
        </div>
      </div>
    </aside>
  );

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3",
        lineTableFillHeight && "h-full min-h-0 flex-1 overflow-hidden"
      )}
    >
      <div className="shrink-0 w-full min-w-0">
        <PoFormHeader
          form={form}
          locations={locations}
          suppliers={suppliers}
          disabled={isPending}
          defaultCurrency={defaultCurrency}
          layout={resolvedDocumentLayout}
          onPatch={onPatch}
        />
      </div>

      {useWidePartialDrawer ? (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch">
          <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-3 overflow-hidden lg:min-w-0">
            {PO_LINES_SECTION_LABEL}
            <div className={poLinesTableSlotClass(lineTableFillHeight)}>{linesTable}</div>
          </div>
          {sideRail}
        </section>
      ) : useFullPageLayout ? (
        <>
          <section
            className={cn(
              "flex w-full min-w-0 max-w-full flex-col gap-3",
              lineTableFillHeight && "min-h-0 flex-1 overflow-hidden lg:flex-row lg:items-stretch lg:gap-4"
            )}
          >
            <div
              className={cn(
                "flex min-w-0 max-w-full flex-col gap-3",
                lineTableFillHeight && "min-h-0 flex-1 overflow-hidden lg:min-w-0"
              )}
            >
              {PO_LINES_SECTION_LABEL}
              <div className={poLinesTableSlotClass(lineTableFillHeight)}>{linesTable}</div>
            </div>
            <div className="hidden lg:flex lg:min-h-0">{sideRail}</div>
          </section>
          <div className="relative z-0 flex w-full min-w-0 shrink-0 flex-col gap-4 bg-background lg:hidden">
            {stackedSummaryDetails}
          </div>
        </>
      ) : lineTableFillHeight ? (
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(12rem,1fr)_auto] gap-3 overflow-hidden">
          <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
            {PO_LINES_SECTION_LABEL}
            <div className={poLinesTableSlotClass(true)}>{linesTable}</div>
          </section>
          <div className="max-h-[min(40vh,16rem)] min-h-0 overflow-y-auto border-t border-border pt-4">
            {stackedSummaryDetails}
          </div>
        </div>
      ) : (
        <>
          <section className="flex w-full min-w-0 max-w-full flex-col gap-4">
            <div className="flex min-w-0 max-w-full flex-col gap-3">
              {PO_LINES_SECTION_LABEL}
              <div className={poLinesTableSlotClass(false)}>{linesTable}</div>
            </div>
          </section>
          <div className="flex w-full min-w-0 flex-col gap-4 border-t border-border pt-4">
            {stackedSummaryDetails}
          </div>
        </>
      )}
    </div>
  );
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
  defaultCurrency,
  documentLayout: documentLayoutProp,
  preferredDestinationLocationId = null,
}: Props) {
  const readOnly = surface === "peek";
  const isMutating = isMutationSurface(surface);
  const documentLayout = usePoDocumentLayout(documentLayoutProp);
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

  const [form, setForm] = useState<PoDraftFormState>(() =>
    defaultPoDraftForm(locations, suppliers, defaultCurrency, preferredDestinationLocationId)
  );
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<UserFacingErrorAction | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState<PurchaseOrderRow | null>(peekOrder);
  const [detailLoading, setDetailLoading] = useState(false);
  const submitRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!open) return;
    setError(null);
    setErrorAction(null);
    setIsDirty(false);
    if (surface !== "peek") {
      setForm(defaultPoDraftForm(locations, suppliers, defaultCurrency, preferredDestinationLocationId));
      setDetail(peekOrder);
    } else if (peekOrder?.lines?.length) {
      setDetail(peekOrder);
    }
  }, [open, surface, peekOrder?.id, peekOrder?.lines?.length, locations, suppliers, defaultCurrency, preferredDestinationLocationId]);

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
      const payload = {
        purchase_order_id: editOrderId ?? detail?.id ?? null,
        destination_location_id: form.destination_location_id,
        supplier_id: form.supplier_id,
        currency_code: form.currency_code,
        payment_terms_days: form.payment_terms_days,
        custom_fields: form.custom_fields,
        lines: filterSavablePoLines(form.lines).map((line) => ({
          variant_id: line.variant_id,
          quantity_ordered: line.quantity_ordered,
          unit_price_contractual: line.unit_price_contractual || "0",
        })),
      };

      const result = await savePurchaseOrder(payload);
      if ("error" in result) {
        setError(result.error ?? "Unable to save purchase order.");
        setErrorAction(result.errorAction ?? null);
        return;
      }

      toast.success("Purchase order saved");
      setIsDirty(false);
      onAfterSave(result.purchaseOrderId);
    });
  }, [detail?.id, editOrderId, form, onAfterSave]);

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
      <PoMutatingFormContent
        form={form}
        locations={locations}
        suppliers={suppliers}
        editOrderId={editOrderId ?? detail?.id ?? null}
        defaultCurrency={defaultCurrency}
        documentLayout={documentLayout}
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
          setIsDirty(true);
        }}
      />
    ) : null;

  const drawerBody = (
    <>
      <PoDrawerLayoutBridge onLayout={handleDrawerLayout} />
      {errorBanner}
      {loadingMessage}
      {readOnly && detail ? <PoPeekView order={detail} layout={documentLayout} /> : null}
      {mutatingForm}
    </>
  );

  return (
    <>
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
