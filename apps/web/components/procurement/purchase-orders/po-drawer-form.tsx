"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  issuePurchaseOrder,
  loadPurchaseOrderDetail,
  savePurchaseOrder,
} from "@/app/procurement/purchase-orders/actions";
import { PoDetailsPanel } from "@/components/procurement/purchase-orders/po-details-panel";
import { PoFormHeader } from "@/components/procurement/purchase-orders/po-form-header";
import { PoLineEntryTable } from "@/components/procurement/purchase-orders/po-line-entry-table";
import { PoPeekView } from "@/components/procurement/purchase-orders/po-peek-view";
import { PoTotalsPanel } from "@/components/procurement/purchase-orders/po-totals-panel";
import {
  isNarrowRightDrawer,
  RightDrawer,
  useRightDrawerLayout,
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
};

function resolveDrawerTitle(surface: DrawerSurface, order: PurchaseOrderRow | null): string {
  if (surface === "create") return "New purchase order";
  return order?.voucher_number ?? "Purchase order";
}

type PoMutatingFormContentProps = {
  form: PoDraftFormState;
  locations: ProcurementLocationOption[];
  suppliers: ProcurementSupplierOption[];
  assignedVoucherNumber: string | null;
  editOrderId: string | null;
  defaultCurrency: string;
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
  assignedVoucherNumber,
  editOrderId,
  defaultCurrency,
  isPending,
  onPatch,
  onLinesChange,
}: PoMutatingFormContentProps) {
  const drawerLayout = useRightDrawerLayout();
  const stackVertically = isNarrowRightDrawer(drawerLayout);
  const usePageScroll = stackVertically || drawerLayout?.isPartialDrawer !== true;
  /** Wide partial drawer: lines scroll inside the panel; summary lives in the right rail. */
  const useWidePartialDrawer = !usePageScroll && !stackVertically;
  /** Full-page drawer on large viewports: lines + side rail; stacked summary below lg. */
  const useFullPageSideRail = usePageScroll && !stackVertically;

  const linesTable = (
    <PoLineEntryTable
      fillHeight={useWidePartialDrawer}
      showSectionTitle={false}
      lines={form.lines}
      supplierId={form.supplier_id}
      destinationLocationId={form.destination_location_id}
      excludePurchaseOrderId={editOrderId}
      disabled={isPending}
      onChange={onLinesChange}
    />
  );

  const stackedSummaryDetails = (
    <>
      <div className="space-y-3 border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Summary
        </p>
        <PoTotalsPanel lines={form.lines} layout="embedded" />
      </div>
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Details
        </p>
        <PoDetailsPanel
          form={form}
          disabled={isPending}
          layout="stack"
          stackVertically={stackVertically}
          onPatch={onPatch}
        />
      </div>
    </>
  );

  const sideRail = (
    <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[15rem]">
      <div className="shrink-0 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Summary
        </p>
        <PoTotalsPanel lines={form.lines} layout="embedded" />
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
            onPatch={onPatch}
          />
        </div>
      </div>
    </aside>
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        useWidePartialDrawer ? "h-full min-h-0 flex-1 overflow-hidden" : "min-h-0"
      )}
    >
      <div className="shrink-0">
        <PoFormHeader
          form={form}
          locations={locations}
          suppliers={suppliers}
          assignedVoucherNumber={assignedVoucherNumber}
          disabled={isPending}
          stackVertically={stackVertically}
          defaultCurrency={defaultCurrency}
          onPatch={onPatch}
        />
      </div>

      {useWidePartialDrawer ? (
        <section className="flex min-h-0 flex-1 flex-row gap-4 overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
            <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Lines
            </p>
            {linesTable}
          </div>
          {sideRail}
        </section>
      ) : useFullPageSideRail ? (
        <>
          <section className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:gap-4">
            <div className="flex min-w-0 flex-col gap-3 lg:min-h-0 lg:flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lines
              </p>
              {linesTable}
            </div>
            <div className="hidden lg:flex">{sideRail}</div>
          </section>
          <div className="relative z-0 flex w-full min-w-0 shrink-0 flex-col gap-3 bg-background lg:hidden">
            {stackedSummaryDetails}
          </div>
        </>
      ) : (
        <>
          <div className="flex w-full min-w-0 flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Lines
            </p>
            {linesTable}
          </div>
          <div className="relative z-0 flex w-full min-w-0 shrink-0 flex-col gap-3 bg-background">
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
}: Props) {
  const readOnly = surface === "peek";
  const isMutating = isMutationSurface(surface);
  const resolvedPeekRecordId =
    surface === "peek" ? (peekOrder?.id ?? peekRecordId) : null;
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating,
  });

  const [form, setForm] = useState<PoDraftFormState>(() =>
    defaultPoDraftForm(locations, suppliers, defaultCurrency)
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
      setForm(defaultPoDraftForm(locations, suppliers, defaultCurrency));
      setDetail(peekOrder);
    } else if (peekOrder?.lines?.length) {
      setDetail(peekOrder);
    }
  }, [open, surface, peekOrder?.id, peekOrder?.lines?.length, locations, suppliers, defaultCurrency]);

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

  const mutationFooter =
    isMutating ? (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => handleRequestClose()}
        >
          Cancel
        </Button>
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
    ) : null;

  if (!open || surface === "closed") return discardDialog;

  const detailReadyForPeek = detail?.id === resolvedPeekRecordId;
  const showLoadingPeek =
    surface === "peek" &&
    resolvedPeekRecordId != null &&
    (detailLoading || !detailReadyForPeek);
  const showLoadingEdit = surface === "edit" && detailLoading;
  const assignedVoucherNumber = detail?.voucher_number ?? null;

  return (
    <>
      <RightDrawer
        open={open}
        onOpenChange={(next) => {
          if (next) return;
          handleRequestClose();
        }}
        onRequestClose={handleRequestClose}
        title={resolveDrawerTitle(surface, detail)}
        headerActions={headerActions}
        footer={mutationFooter}
        allowBackgroundInteraction={surface === "peek"}
        className={surface === "peek" ? "module-drawer-peek-shell" : undefined}
        bodyClassName={
          surface === "peek"
            ? "module-drawer-peek-body"
            : isMutating
              ? "module-drawer-form-body"
              : undefined
        }
        scrollable
        showCloseButton
      >
        {error ? (
          <UserFacingErrorMessage
            message={error}
            action={errorAction ?? undefined}
            className="mb-4"
          />
        ) : null}

        {showLoadingPeek || showLoadingEdit ? (
          <p className="text-sm text-muted-foreground">Loading purchase order…</p>
        ) : readOnly && detail ? (
          <PoPeekView order={detail} />
        ) : isMutating ? (
          <PoMutatingFormContent
            form={form}
            locations={locations}
            suppliers={suppliers}
            assignedVoucherNumber={assignedVoucherNumber}
            editOrderId={editOrderId ?? detail?.id ?? null}
            defaultCurrency={defaultCurrency}
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
        ) : null}
      </RightDrawer>
      {discardDialog}
    </>
  );
}
