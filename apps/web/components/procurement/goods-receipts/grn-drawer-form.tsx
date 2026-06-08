"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  loadGoodsReceiptDetail,
  postGoodsReceipt,
} from "@/app/procurement/goods-receipts/actions";
import { StockVariantSkuField } from "@/components/inventory/stock/stock-variant-sku-field";
import { RightDrawer } from "@/components/ui/right-drawer";
import { UserFacingErrorMessage } from "@/components/ui/user-facing-error-message";
import type { UserFacingErrorAction } from "@/lib/errors/user-facing-error";
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
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import type { ReceivablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";
import type { ProcurementLocationOption } from "@/lib/procurement/shared/types";

type DraftLine = {
  key: string;
  sku: string;
  variant_id: string;
  item_name: string;
  variant_sku: string;
  po_item_id: string | null;
  quantity_received: string;
  raw_unit_cost: string;
  open_quantity: string | null;
  skuError: string | null;
};

type CreateFormState = {
  destination_location_id: string;
  purchase_order_id: string | null;
  lines: DraftLine[];
};

type Props = {
  open: boolean;
  surface: DrawerSurface;
  locations: ProcurementLocationOption[];
  receivableOrders: ReceivablePurchaseOrderOption[];
  peekReceipt: GoodsReceiptRow | null;
  prefillPurchaseOrderId?: string | null;
  onClose: () => void;
  onAfterSave: (goodsReceiptId: string) => void;
};

function createEmptyLine(): DraftLine {
  return {
    key: crypto.randomUUID(),
    sku: "",
    variant_id: "",
    item_name: "",
    variant_sku: "",
    po_item_id: null,
    quantity_received: "",
    raw_unit_cost: "0",
    open_quantity: null,
    skuError: null,
  };
}

function defaultCreateForm(
  locations: ProcurementLocationOption[],
  prefillPoId?: string | null,
  receivableOrders: ReceivablePurchaseOrderOption[] = []
): CreateFormState {
  const selectedPo = prefillPoId
    ? receivableOrders.find((order) => order.id === prefillPoId)
    : null;

  if (selectedPo) {
    return {
      destination_location_id: selectedPo.destination_location_id,
      purchase_order_id: selectedPo.id,
      lines: selectedPo.lines.map((line) => ({
        key: line.id,
        sku: line.variant_sku,
        variant_id: line.variant_id,
        item_name: line.item_name,
        variant_sku: line.variant_sku,
        po_item_id: line.id,
        quantity_received: line.open_quantity,
        raw_unit_cost: line.unit_price_contractual,
        open_quantity: line.open_quantity,
        skuError: null,
      })),
    };
  }

  return {
    destination_location_id: locations[0]?.id ?? "",
    purchase_order_id: null,
    lines: [createEmptyLine()],
  };
}

function resolveDrawerTitle(surface: DrawerSurface, receipt: GoodsReceiptRow | null): string {
  if (surface === "create") return "New goods receipt";
  return receipt?.voucher_number ?? "Goods receipt";
}

export function GrnDrawerForm({
  open,
  surface,
  locations,
  receivableOrders,
  peekReceipt,
  prefillPurchaseOrderId = null,
  onClose,
  onAfterSave,
}: Props) {
  const readOnly = surface === "peek";
  const isMutating = isMutationSurface(surface);
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating,
  });

  const prefillSignature = prefillPurchaseOrderId ?? "";

  const [form, setForm] = useState<CreateFormState>(() =>
    defaultCreateForm(locations, prefillPurchaseOrderId, receivableOrders)
  );
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<UserFacingErrorAction | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState<GoodsReceiptRow | null>(peekReceipt);
  const [detailLoading, setDetailLoading] = useState(false);
  const submitRef = useRef<() => void>(() => {});

  const filteredReceivableOrders = useMemo(() => {
    if (!form.destination_location_id) return receivableOrders;
    return receivableOrders.filter(
      (order) => order.destination_location_id === form.destination_location_id
    );
  }, [form.destination_location_id, receivableOrders]);

  const openQtyByPoItemId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const line of form.lines) {
      if (line.po_item_id && line.open_quantity != null) {
        map[line.po_item_id] = line.open_quantity;
      }
    }
    return map;
  }, [form.lines]);

  useEffect(() => {
    if (!open) return;
    setForm(defaultCreateForm(locations, prefillPurchaseOrderId, receivableOrders));
    setError(null);
    setErrorAction(null);
    setIsDirty(false);
    setDetail(peekReceipt);
  }, [open, surface, peekReceipt?.id, locations, prefillSignature, prefillPurchaseOrderId, receivableOrders]);

  useEffect(() => {
    if (!open || surface !== "peek" || !peekReceipt?.id) return;
    if (peekReceipt.lines?.length) {
      setDetail(peekReceipt);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void loadGoodsReceiptDetail(peekReceipt.id).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDetail(result.goodsReceipt);
    });

    return () => {
      cancelled = true;
    };
  }, [open, surface, peekReceipt]);

  const patchForm = useCallback((next: Partial<CreateFormState>) => {
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

  const handlePoChange = (purchaseOrderId: string) => {
    if (purchaseOrderId === "none") {
      patchForm({
        purchase_order_id: null,
        lines: [createEmptyLine()],
      });
      return;
    }

    const selectedPo = receivableOrders.find((order) => order.id === purchaseOrderId);
    if (!selectedPo) return;

    patchForm({
      destination_location_id: selectedPo.destination_location_id,
      purchase_order_id: selectedPo.id,
      lines: selectedPo.lines.map((line) => ({
        key: line.id,
        sku: line.variant_sku,
        variant_id: line.variant_id,
        item_name: line.item_name,
        variant_sku: line.variant_sku,
        po_item_id: line.id,
        quantity_received: line.open_quantity,
        raw_unit_cost: line.unit_price_contractual,
        open_quantity: line.open_quantity,
        skuError: null,
      })),
    });
  };

  const addLine = () => {
    if (form.purchase_order_id) return;
    patchForm({ lines: [...form.lines, createEmptyLine()] });
  };

  const removeLine = (key: string) => {
    if (form.lines.length <= 1 || form.purchase_order_id) return;
    patchForm({ lines: form.lines.filter((line) => line.key !== key) });
  };

  const handleSubmit = useCallback(() => {
    setError(null);
    setErrorAction(null);
    startTransition(async () => {
      const payload = {
        destination_location_id: form.destination_location_id,
        purchase_order_id: form.purchase_order_id,
        lines: form.lines.map((line) => ({
          variant_id: line.variant_id,
          po_item_id: line.po_item_id,
          quantity_received: line.quantity_received,
          raw_unit_cost: line.raw_unit_cost,
        })),
      };

      const result = await postGoodsReceipt(
        payload,
        form.purchase_order_id ? openQtyByPoItemId : undefined
      );
      if ("error" in result) {
        setError(result.error ?? "Unable to post goods receipt.");
        setErrorAction(result.errorAction ?? null);
        return;
      }

      toast.success("Goods receipt posted");
      closeForm();
      onAfterSave(result.goodsReceiptId);
    });
  }, [closeForm, form, onAfterSave, openQtyByPoItemId]);

  submitRef.current = handleSubmit;

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

  const headerActions = isMutating ? (
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
        disabled={isPending || locations.length === 0}
        onClick={handleSubmit}
        title="Post receipt (Ctrl+Enter)"
      >
        {isPending ? "Posting…" : "Post receipt"}
      </Button>
    </>
  ) : null;

  if (!open || surface === "closed") return discardDialog;

  const showLoadingPeek = surface === "peek" && detailLoading && !detail?.lines?.length;
  const poLocked = Boolean(form.purchase_order_id);

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

        {showLoadingPeek ? (
          <p className="text-sm text-muted-foreground">Loading goods receipt…</p>
        ) : readOnly && detail ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Location</p>
                <p className="text-sm font-medium">{detail.destination_location_name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Purchase order</p>
                <p className="font-mono text-sm">{detail.purchase_order_number ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Received</p>
                <p className="text-sm">{formatDate(detail.received_at)}</p>
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
                      <th className="p-2 text-right">Received</th>
                      <th className="p-2 text-right">Unit cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.lines ?? []).map((line) => (
                      <tr key={line.id} className="border-b border-border">
                        <td className="p-2">
                          <div className="font-mono text-xs">{line.variant_sku}</div>
                          <div className="text-xs text-muted-foreground">{line.item_name}</div>
                        </td>
                        <td className="p-2 text-right tabular-nums">{line.quantity_received}</td>
                        <td className="p-2 text-right tabular-nums">{line.raw_unit_cost}</td>
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
                <Label>Purchase order (optional)</Label>
                <Select
                  value={form.purchase_order_id ?? "none"}
                  onValueChange={handlePoChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Standalone receipt" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Standalone receipt</SelectItem>
                    {filteredReceivableOrders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.voucher_number} — {order.supplier_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Destination location</Label>
                <Select
                  value={form.destination_location_id}
                  disabled={poLocked}
                  onValueChange={(value) =>
                    patchForm({
                      destination_location_id: value,
                      purchase_order_id: null,
                      lines: [createEmptyLine()],
                    })
                  }
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
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Lines
                </p>
                {!poLocked ? (
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addLine}>
                    <Plus className="h-3.5 w-3.5" />
                    Add line
                  </Button>
                ) : null}
              </div>

              {form.lines.map((line) => (
                <div
                  key={line.key}
                  className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_120px_120px_auto]"
                >
                  {poLocked ? (
                    <div>
                      <p className="font-mono text-xs font-medium">{line.variant_sku}</p>
                      <p className="text-xs text-muted-foreground">{line.item_name}</p>
                      {line.open_quantity ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Open: {line.open_quantity}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <StockVariantSkuField
                      disabled={isPending}
                      value={{
                        sku: line.sku,
                        variant_id: line.variant_id,
                        item_name: line.item_name,
                        variant_sku: line.variant_sku,
                        unit_cost: line.raw_unit_cost || "0",
                        skuError: line.skuError,
                      }}
                      onChange={(patch) =>
                        patchLine(line.key, {
                          ...patch,
                          raw_unit_cost: patch.unit_cost ?? line.raw_unit_cost,
                        })
                      }
                    />
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Qty received</Label>
                    <Input
                      value={line.quantity_received}
                      onChange={(event) =>
                        patchLine(line.key, { quantity_received: event.target.value })
                      }
                      inputMode="decimal"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit cost</Label>
                    <Input
                      value={line.raw_unit_cost}
                      onChange={(event) =>
                        patchLine(line.key, { raw_unit_cost: event.target.value })
                      }
                      inputMode="decimal"
                    />
                  </div>
                  {!poLocked ? (
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
                  ) : null}
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
