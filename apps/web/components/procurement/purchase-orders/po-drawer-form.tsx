"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  issuePurchaseOrder,
  loadPurchaseOrderDetail,
  savePurchaseOrder,
} from "@/app/procurement/purchase-orders/actions";
import { StockVariantSkuField } from "@/components/inventory/stock/stock-variant-sku-field";
import { RightDrawer } from "@/components/ui/right-drawer";
import { UserFacingErrorMessage } from "@/components/ui/user-facing-error-message";
import type { UserFacingErrorAction } from "@/lib/errors/user-facing-error";
import { Badge } from "@/components/ui/badge";
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
import { formatDate } from "@/lib/dashboard/format";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import { isMutationSurface, type DrawerSurface } from "@/lib/layout/module-drawer-url";
import {
  purchaseOrderStatusBadgeVariant,
  purchaseOrderStatusLabel,
} from "@/lib/procurement/purchase-orders/labels";
import { PROCUREMENT_GRN_HREF, GRN_DRAWER_PO_PARAM } from "@/lib/procurement/navigation";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";

type DraftLine = {
  key: string;
  sku: string;
  variant_id: string;
  item_name: string;
  variant_sku: string;
  quantity_ordered: string;
  unit_price_contractual: string;
  skuError: string | null;
};

type DraftFormState = {
  destination_location_id: string;
  supplier_id: string;
  lines: DraftLine[];
};

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

function createEmptyLine(): DraftLine {
  return {
    key: crypto.randomUUID(),
    sku: "",
    variant_id: "",
    item_name: "",
    variant_sku: "",
    quantity_ordered: "",
    unit_price_contractual: "0",
    skuError: null,
  };
}

function defaultDraftForm(
  locations: ProcurementLocationOption[],
  suppliers: ProcurementSupplierOption[]
): DraftFormState {
  return {
    destination_location_id: locations[0]?.id ?? "",
    supplier_id: suppliers[0]?.id ?? "",
    lines: [createEmptyLine()],
  };
}

function mapOrderToDraft(order: PurchaseOrderRow): DraftFormState {
  return {
    destination_location_id: order.destination_location_id,
    supplier_id: order.supplier_id,
    lines:
      order.lines?.length
        ? order.lines.map((line) => ({
            key: line.id,
            sku: line.variant_sku,
            variant_id: line.variant_id,
            item_name: line.item_name,
            variant_sku: line.variant_sku,
            quantity_ordered: line.quantity_ordered,
            unit_price_contractual: line.unit_price_contractual,
            skuError: null,
          }))
        : [createEmptyLine()],
  };
}

function resolveDrawerTitle(surface: DrawerSurface, order: PurchaseOrderRow | null): string {
  if (surface === "create") return "New purchase order";
  return order?.voucher_number ?? "Purchase order";
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

  const [form, setForm] = useState<DraftFormState>(() =>
    defaultDraftForm(locations, suppliers)
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
    setForm(defaultDraftForm(locations, suppliers));
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
      setForm(mapOrderToDraft(result.purchaseOrder));
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

  const patchForm = useCallback((next: Partial<DraftFormState>) => {
    setForm((current) => ({ ...current, ...next }));
    setIsDirty(true);
  }, []);

  const patchLine = useCallback((key: string, next: Partial<DraftLine>) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, ...next } : line)),
    }));
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

  const addLine = () => {
    patchForm({ lines: [...form.lines, createEmptyLine()] });
  };

  const removeLine = (key: string) => {
    if (form.lines.length <= 1) return;
    patchForm({ lines: form.lines.filter((line) => line.key !== key) });
  };

  const handleSaveDraft = useCallback(() => {
    setError(null);
    setErrorAction(null);
    startTransition(async () => {
      const payload = {
        purchase_order_id: editOrderId ?? detail?.id ?? null,
        destination_location_id: form.destination_location_id,
        supplier_id: form.supplier_id,
        lines: form.lines.map((line) => ({
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
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Supplier</p>
                <p className="text-sm font-medium">{detail.supplier_name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Destination</p>
                <p className="text-sm font-medium">{detail.destination_location_name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Status</p>
                <Badge variant={purchaseOrderStatusBadgeVariant(detail.document_status)}>
                  {purchaseOrderStatusLabel(detail.document_status)}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Updated</p>
                <p className="text-sm">{formatDate(detail.updated_at)}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lines
              </p>
              <div className="surface-inset overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">SKU</th>
                      <th className="p-2 text-right">Ordered</th>
                      <th className="p-2 text-right">Received</th>
                      <th className="p-2 text-right">Unit price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.lines ?? []).map((line) => (
                      <tr key={line.id} className="border-b border-border">
                        <td className="p-2">
                          <div className="font-mono text-xs">{line.variant_sku}</div>
                          <div className="text-xs text-muted-foreground">{line.item_name}</div>
                        </td>
                        <td className="p-2 text-right tabular-nums">{line.quantity_ordered}</td>
                        <td className="p-2 text-right tabular-nums">{line.quantity_received}</td>
                        <td className="p-2 text-right tabular-nums">
                          {line.unit_price_contractual}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : isMutating ? (
          <div className="space-y-6 pb-20">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Destination location</Label>
                <Select
                  value={form.destination_location_id}
                  onValueChange={(value) => patchForm({ destination_location_id: value })}
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
                <Label>Supplier</Label>
                <Select
                  value={form.supplier_id}
                  onValueChange={(value) => patchForm({ supplier_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Lines
                </p>
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addLine}>
                  <Plus className="h-3.5 w-3.5" />
                  Add line
                </Button>
              </div>

              {form.lines.map((line) => (
                <div
                  key={line.key}
                  className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_120px_120px_auto]"
                >
                  <StockVariantSkuField
                    disabled={isPending}
                    value={{
                      sku: line.sku,
                      variant_id: line.variant_id,
                      item_name: line.item_name,
                      variant_sku: line.variant_sku,
                      unit_cost: line.unit_price_contractual || "0",
                      skuError: line.skuError,
                    }}
                    onChange={(patch) =>
                      patchLine(line.key, {
                        ...patch,
                        unit_price_contractual:
                          patch.unit_cost ?? line.unit_price_contractual,
                      })
                    }
                  />
                  <div className="space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      value={line.quantity_ordered}
                      onChange={(event) =>
                        patchLine(line.key, { quantity_ordered: event.target.value })
                      }
                      inputMode="decimal"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit price</Label>
                    <Input
                      value={line.unit_price_contractual}
                      onChange={(event) =>
                        patchLine(line.key, { unit_price_contractual: event.target.value })
                      }
                      inputMode="decimal"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 shrink-0 p-0 text-muted-foreground"
                      disabled={form.lines.length <= 1}
                      onClick={() => removeLine(line.key)}
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </RightDrawer>
      {discardDialog}
    </>
  );
}
