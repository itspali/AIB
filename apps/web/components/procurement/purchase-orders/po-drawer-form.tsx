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
  editOrderId: string | null;
  onClose: () => void;
  onAfterSave: (purchaseOrderId: string) => void;
  onOpenEdit: (purchaseOrderId: string) => void;
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
  isPending,
  onPatch,
  onLinesChange,
}: PoMutatingFormContentProps) {
  const drawerLayout = useRightDrawerLayout();
  const stackVertically = isNarrowRightDrawer(drawerLayout);
  const usePageScroll = stackVertically || drawerLayout?.isPartialDrawer !== true;

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        usePageScroll ? "min-h-0" : "h-full min-h-0 flex-1 overflow-hidden"
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
          onPatch={onPatch}
        />
      </div>

      <div className={cn("shrink-0", !stackVertically && "lg:hidden")}>
        <PoDetailsPanel
          form={form}
          disabled={isPending}
          layout="stack"
          stackVertically={stackVertically}
          onPatch={onPatch}
        />
      </div>

      <section
        className={cn(
          "flex flex-col gap-3",
          usePageScroll ? "min-h-0" : "min-h-0 flex-1 overflow-hidden",
          !stackVertically && "lg:flex-row lg:gap-4"
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-col gap-3",
            usePageScroll ? "min-h-0" : "min-h-0 min-w-0 flex-1 overflow-hidden"
          )}
        >
          <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lines
          </p>
          <PoLineEntryTable
            fillHeight={!usePageScroll}
            showSectionTitle={false}
            lines={form.lines}
            supplierId={form.supplier_id}
            disabled={isPending}
            onChange={onLinesChange}
          />
        </div>

        <div
          className={cn(
            "hidden min-h-0 shrink-0 flex-col gap-4 overflow-hidden",
            !stackVertically && "lg:flex lg:w-[15rem]"
          )}
        >
          <div className="shrink-0 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Summary
            </p>
            <PoTotalsPanel lines={form.lines} layout="embedded" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Details
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <PoDetailsPanel
                form={form}
                disabled={isPending}
                layout="rail"
                onPatch={onPatch}
              />
            </div>
          </div>
        </div>
      </section>

      <PoTotalsPanel
        lines={form.lines}
        layout="footer"
        showFooterOnLarge={stackVertically}
      />
    </div>
  );
}

export function PoDrawerForm({
  open,
  surface,
  locations,
  suppliers,
  peekOrder,
  editOrderId,
  onClose,
  onAfterSave,
  onOpenEdit,
}: Props) {
  const readOnly = surface === "peek";
  const isMutating = isMutationSurface(surface);
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating,
  });

  const [form, setForm] = useState<PoDraftFormState>(() => defaultPoDraftForm(locations, suppliers));
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<UserFacingErrorAction | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState<PurchaseOrderRow | null>(peekOrder);
  const [detailLoading, setDetailLoading] = useState(false);
  const submitRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!open) return;
    setForm(defaultPoDraftForm(locations, suppliers));
    setError(null);
    setErrorAction(null);
    setIsDirty(false);
    setDetail(peekOrder);
  }, [open, surface, peekOrder?.id, locations, suppliers]);

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

  useEffect(() => {
    if (!open || surface !== "peek" || !peekOrder?.id) return;
    if (peekOrder.lines?.length) {
      setDetail(peekOrder);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void loadPurchaseOrderDetail(peekOrder.id).then((result) => {
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
  }, [open, surface, peekOrder]);

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
      closeForm();
      onAfterSave(result.purchaseOrderId);
    });
  }, [closeForm, detail?.id, editOrderId, form, onAfterSave]);

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
      closeForm();
      onAfterSave(result.purchaseOrderId);
    });
  }, [closeForm, detail?.id, editOrderId, onAfterSave]);

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

  const headerActions =
    surface === "peek" && detail ? (
      <>
        {detail.document_status === "DRAFT" ? (
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
          title="Save draft (Ctrl+Enter)"
        >
          {isPending ? "Saving…" : "Save draft"}
        </Button>
        {(editOrderId ?? detail?.id) && detail?.document_status === "DRAFT" ? (
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

  const showLoadingPeek = surface === "peek" && detailLoading && !detail?.lines?.length;
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
        allowBackgroundInteraction={surface === "peek"}
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
