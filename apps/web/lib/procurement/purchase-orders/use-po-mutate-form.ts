"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  issuePurchaseOrder,
  loadPurchaseOrderDetail,
  savePurchaseOrder,
  updatePurchaseOrderVoucherNumber,
} from "@/app/procurement/purchase-orders/actions";
import { canEditPurchaseOrderDocument } from "@/lib/procurement/access";
import {
  copyPoDraftFromOrder,
  defaultPoDraftForm,
  filterSavablePoLines,
  mapPurchaseOrderToDraft,
  type PoDraftFormState,
} from "@/lib/procurement/purchase-orders/draft-form";
import { resolvePoDraftLineUomCode } from "@/lib/procurement/purchase-orders/po-line-unit";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";
import type { UserFacingErrorAction } from "@/lib/errors/user-facing-error";

type Mode = "create" | "edit";

type Options = {
  mode: Mode;
  editOrderId?: string | null;
  copyFromId?: string | null;
  locations: ProcurementLocationOption[];
  suppliers: ProcurementSupplierOption[];
  defaultCurrency: string;
  preferredDestinationLocationId?: string | null;
  editAccessGranted: boolean;
  allowEditIssuedPurchaseOrders: boolean;
  onAfterSave: (purchaseOrderId: string) => void;
  onEditNotAllowed?: (purchaseOrderId: string) => void;
};

export function usePoMutateForm({
  mode,
  editOrderId = null,
  copyFromId = null,
  locations,
  suppliers,
  defaultCurrency,
  preferredDestinationLocationId = null,
  editAccessGranted,
  allowEditIssuedPurchaseOrders,
  onAfterSave,
  onEditNotAllowed,
}: Options) {
  const [form, setForm] = useState<PoDraftFormState>(() =>
    defaultPoDraftForm(locations, suppliers, defaultCurrency, preferredDestinationLocationId)
  );
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<UserFacingErrorAction | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState<PurchaseOrderRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(mode === "edit");
  const submitRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (mode === "create" && !copyFromId) {
      setForm(
        defaultPoDraftForm(locations, suppliers, defaultCurrency, preferredDestinationLocationId)
      );
      setDetail(null);
      setIsDirty(false);
      setError(null);
      setErrorAction(null);
    }
  }, [
    copyFromId,
    defaultCurrency,
    locations,
    mode,
    preferredDestinationLocationId,
    suppliers,
  ]);

  useEffect(() => {
    if (mode !== "create" || !copyFromId) return;

    let cancelled = false;
    setDetailLoading(true);
    void loadPurchaseOrderDetail(copyFromId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to duplicate purchase order.");
        setError(result.error);
        setForm(
          defaultPoDraftForm(locations, suppliers, defaultCurrency, preferredDestinationLocationId)
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
    mode,
    preferredDestinationLocationId,
    suppliers,
  ]);

  useEffect(() => {
    if (mode !== "edit" || !editOrderId) return;

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
  }, [editOrderId, mode]);

  const canEditThisOrder =
    detail != null
      ? canEditPurchaseOrderDocument(detail.document_status, {
          allowEditIssued: allowEditIssuedPurchaseOrders,
          hasEditPermission: editAccessGranted,
        })
      : editAccessGranted;

  useEffect(() => {
    if (mode !== "edit" || detailLoading || !detail?.id || !onEditNotAllowed) return;
    if (!canEditThisOrder) {
      onEditNotAllowed(detail.id);
    }
  }, [canEditThisOrder, detail?.id, detailLoading, mode, onEditNotAllowed]);

  const patchForm = useCallback((next: Partial<PoDraftFormState>) => {
    setForm((current) => ({ ...current, ...next }));
    setIsDirty(true);
  }, []);

  const handleLinesChange = useCallback(
    (
      linesOrUpdater:
        | PoDraftFormState["lines"]
        | ((current: PoDraftFormState["lines"]) => PoDraftFormState["lines"])
    ) => {
      setForm((current) => ({
        ...current,
        lines:
          typeof linesOrUpdater === "function"
            ? linesOrUpdater(current.lines)
            : linesOrUpdater,
      }));
      setIsDirty(true);
    },
    []
  );

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
          discount_percentage: line.discount_percentage || "0",
          discount_amount: line.discount_amount || "0",
          uom_code: resolvePoDraftLineUomCode(line) ?? undefined,
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
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        submitRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const purchaseOrderId = editOrderId ?? detail?.id ?? null;
  const isDraftOrder = detail?.document_status === "DRAFT";
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

  return {
    form,
    detail,
    detailLoading,
    error,
    errorAction,
    isDirty,
    isPending,
    canEditThisOrder,
    isDraftOrder,
    saveActionLabel,
    purchaseOrderId,
    canEditVoucherNumber,
    patchForm,
    handleLinesChange,
    handleSaveDraft,
    handleIssue,
    handleSaveVoucherNumber,
    setIsDirty,
  };
}
