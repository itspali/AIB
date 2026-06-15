"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  confirmSalesOrder,
  loadSalesOrderDetail,
  saveSalesOrder,
  submitSalesOrderForApproval,
  updateSalesOrderVoucherNumber,
} from "@/app/sales/orders/actions";
import { canEditSalesOrderDocument } from "@/lib/sales/access";
import {
  copySoDraftFromOrder,
  defaultSoDraftForm,
  filterSavableSoLines,
  mapSalesOrderToDraft,
  type SoDraftFormState,
} from "@/lib/sales/orders/draft-form";
import { buildSalesCommerceSaveExtras } from "@/lib/sales/shared/sales-commerce-save-extras";
import { resolveSalesCommerceSupplyStates } from "@/lib/sales/shared/sales-commerce-draft";
import type { SalesOrderRow } from "@/lib/sales/orders/types";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import type { UserFacingErrorAction } from "@/lib/errors/user-facing-error";

type Mode = "create" | "edit";

type Options = {
  mode: Mode;
  editOrderId?: string | null;
  copyFromId?: string | null;
  locations: SalesLocationOption[];
  customers: CustomerOption[];
  preferredShippingLocationId?: string | null;
  editAccessGranted: boolean;
  allowTransactionDiscounts?: boolean;
  onAfterSave: (salesOrderId: string) => void;
  onEditNotAllowed?: (salesOrderId: string) => void;
};

export function useSoMutateForm({
  mode,
  editOrderId = null,
  copyFromId = null,
  locations,
  customers,
  preferredShippingLocationId = null,
  editAccessGranted,
  allowTransactionDiscounts = false,
  onAfterSave,
  onEditNotAllowed,
}: Options) {
  const entryLineKey = useId();
  const [form, setForm] = useState<SoDraftFormState>(() =>
    defaultSoDraftForm(locations, customers, preferredShippingLocationId, entryLineKey)
  );
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<UserFacingErrorAction | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState<SalesOrderRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(mode === "edit");
  const submitRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (mode === "create" && !copyFromId) {
      setForm(defaultSoDraftForm(locations, customers, preferredShippingLocationId, entryLineKey));
      setDetail(null);
      setIsDirty(false);
      setError(null);
      setErrorAction(null);
    }
  }, [copyFromId, customers, entryLineKey, locations, mode, preferredShippingLocationId]);

  useEffect(() => {
    if (mode !== "create" || !copyFromId) return;

    let cancelled = false;
    setDetailLoading(true);
    void loadSalesOrderDetail(copyFromId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to duplicate sales order.");
        setError(result.error);
        setForm(defaultSoDraftForm(locations, customers, preferredShippingLocationId, entryLineKey));
        return;
      }
      setForm(copySoDraftFromOrder(result.salesOrder));
      setIsDirty(true);
    });

    return () => {
      cancelled = true;
    };
  }, [copyFromId, customers, entryLineKey, locations, mode, preferredShippingLocationId]);

  useEffect(() => {
    if (mode !== "edit" || !editOrderId) return;

    let cancelled = false;
    setDetailLoading(true);
    void loadSalesOrderDetail(editOrderId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDetail(result.salesOrder);
      setForm(mapSalesOrderToDraft(result.salesOrder));
      setIsDirty(false);
    });

    return () => {
      cancelled = true;
    };
  }, [editOrderId, mode]);

  const canEditThisOrder =
    detail != null
      ? canEditSalesOrderDocument(detail.commercial_status, {
          allowEditConfirmed: false,
          hasEditPermission: editAccessGranted,
        })
      : editAccessGranted;

  useEffect(() => {
    if (mode !== "edit" || detailLoading || !detail?.id || !onEditNotAllowed) return;
    if (!canEditThisOrder) onEditNotAllowed(detail.id);
  }, [canEditThisOrder, detail?.id, detailLoading, mode, onEditNotAllowed]);

  const patchForm = useCallback((patch: Partial<SoDraftFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    setIsDirty(true);
  }, []);

  const handleSaveDraft = useCallback(() => {
    setError(null);
    setErrorAction(null);

    startTransition(async () => {
      const savableLines = filterSavableSoLines(form.lines);
      const supplyStates = resolveSalesCommerceSupplyStates({
        customers,
        locations,
        customerId: form.customer_id,
        originLocationId: form.shipping_location_id,
        billingState: form.billing_state,
        shippingState: form.shipping_state,
      });
      const result = await saveSalesOrder({
        sales_order_id: detail?.id ?? null,
        customer_id: form.customer_id,
        shipping_location_id: form.shipping_location_id,
        billing_state: supplyStates.billing_state,
        shipping_state: supplyStates.shipping_state,
        source_quotation_id: form.source_quotation_id,
        custom_fields: form.custom_fields,
        lines: savableLines.map((line) => ({
          variant_id: line.variant_id,
          quantity_ordered: line.quantity_ordered,
          unit_price_selling: line.unit_price_selling,
          discount_percentage: line.discount_percentage,
          discount_amount: line.discount_amount,
        })),
        ...buildSalesCommerceSaveExtras(form, savableLines, {
          allowTransactionDiscounts,
        }),
      });

      if ("error" in result) {
        setError(result.error ?? "Unable to save sales order.");
        setErrorAction(result.errorAction ?? null);
        return;
      }

      toast.success("Sales order saved");
      setIsDirty(false);
      onAfterSave(result.salesOrderId);
    });
  }, [allowTransactionDiscounts, customers, detail?.id, form, locations, onAfterSave]);

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

  const salesOrderId = editOrderId ?? detail?.id ?? null;
  const isDraftOrder = detail?.commercial_status === "DRAFT" || mode === "create";
  const canEditVoucherNumber = isDraftOrder && canEditThisOrder && salesOrderId != null;

  const handleSaveVoucherNumber = useCallback(
    async (next: string) => {
      if (!salesOrderId) {
        return { error: "Save the sales order before changing the SO number." };
      }

      const result = await updateSalesOrderVoucherNumber({
        sales_order_id: salesOrderId,
        voucher_number: next,
      });

      if ("error" in result) {
        return { error: result.error ?? "Unable to save SO number." };
      }

      setDetail((current) =>
        current ? { ...current, voucher_number: result.voucherNumber } : current
      );
      toast.success("SO number updated");
      return {};
    },
    [salesOrderId]
  );

  return {
    form,
    detail,
    detailLoading,
    error,
    errorAction,
    isDirty,
    isPending,
    salesOrderId,
    isDraftOrder,
    canEditVoucherNumber,
    canEditThisOrder,
    saveActionLabel: isDraftOrder ? "Save draft" : "Save",
    patchForm,
    setLines: (linesOrUpdater: SoDraftFormState["lines"] | ((current: SoDraftFormState["lines"]) => SoDraftFormState["lines"])) => {
      setForm((current) => ({
        ...current,
        lines:
          typeof linesOrUpdater === "function" ? linesOrUpdater(current.lines) : linesOrUpdater,
      }));
      setIsDirty(true);
    },
    handleSaveDraft,
    handleSaveVoucherNumber,
  };
}
