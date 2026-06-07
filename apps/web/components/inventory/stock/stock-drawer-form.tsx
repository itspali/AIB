"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { loadStockAdjustmentDetail, postStockAdjustment } from "@/app/inventory/stock/actions";
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
import { stockAdjustmentKindLabel, STOCK_ADJUSTMENT_KINDS } from "@/lib/inventory/stock/labels";
import { formatDate } from "@/lib/dashboard/format";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import { isMutationSurface, type DrawerSurface } from "@/lib/layout/module-drawer-url";
import type {
  StockAdjustmentKind,
  StockAdjustmentRow,
  StockLocationOption,
} from "@/lib/inventory/stock/types";

type DraftLine = {
  key: string;
  sku: string;
  variant_id: string;
  item_name: string;
  variant_sku: string;
  quantity_delta: string;
  unit_cost: string;
  line_notes: string;
  skuError: string | null;
};

type CreateFormState = {
  location_id: string;
  kind: StockAdjustmentKind;
  reason: string;
  notes: string;
  lines: DraftLine[];
};

export type StockDrawerCreatePrefill = {
  location_id: string;
  variant_id: string;
  variant_sku: string;
  item_name: string;
  unit_cost: string;
};

type Props = {
  open: boolean;
  surface: DrawerSurface;
  locations: StockLocationOption[];
  peekAdjustment: StockAdjustmentRow | null;
  createPrefill?: StockDrawerCreatePrefill | null;
  onClose: () => void;
  onAfterSave: (adjustmentId: string) => void;
};

function createEmptyLine(): DraftLine {
  return {
    key: crypto.randomUUID(),
    sku: "",
    variant_id: "",
    item_name: "",
    variant_sku: "",
    quantity_delta: "",
    unit_cost: "0",
    line_notes: "",
    skuError: null,
  };
}

function defaultCreateForm(
  locations: StockLocationOption[],
  prefill?: StockDrawerCreatePrefill | null
): CreateFormState {
  const locationId =
    prefill?.location_id && locations.some((location) => location.id === prefill.location_id)
      ? prefill.location_id
      : (locations[0]?.id ?? "");

  const line = createEmptyLine();
  if (prefill?.variant_id) {
    line.variant_id = prefill.variant_id;
    line.variant_sku = prefill.variant_sku;
    line.sku = prefill.variant_sku;
    line.item_name = prefill.item_name;
    line.unit_cost = prefill.unit_cost || "0";
  }

  return {
    location_id: locationId,
    kind: "CORRECTION",
    reason: "",
    notes: "",
    lines: [line],
  };
}

function resolveDrawerTitle(surface: DrawerSurface, adjustment: StockAdjustmentRow | null): string {
  if (surface === "create") return "New stock adjustment";
  return adjustment?.adjustment_number ?? "Stock adjustment";
}

export function StockDrawerForm({
  open,
  surface,
  locations,
  peekAdjustment,
  createPrefill = null,
  onClose,
  onAfterSave,
}: Props) {
  const readOnly = surface === "peek";
  const isMutating = isMutationSurface(surface);
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating,
  });

  const [form, setForm] = useState<CreateFormState>(() => defaultCreateForm(locations));
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<UserFacingErrorAction | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState<StockAdjustmentRow | null>(peekAdjustment);
  const [detailLoading, setDetailLoading] = useState(false);
  const submitRef = useRef<() => void>(() => {});

  const createPrefillSignature = createPrefill
    ? `${createPrefill.location_id}:${createPrefill.variant_id}:${createPrefill.variant_sku}`
    : "";

  useEffect(() => {
    if (!open) return;
    const nextForm =
      surface === "create"
        ? defaultCreateForm(locations, createPrefill)
        : defaultCreateForm(locations);
    setForm(nextForm);
    setError(null);
    setErrorAction(null);
    setIsDirty(false);
    setDetail(peekAdjustment);
  }, [open, surface, peekAdjustment?.id, locations, createPrefillSignature, createPrefill]);

  useEffect(() => {
    if (!open || surface !== "peek" || !peekAdjustment?.id) return;
    if (peekAdjustment.lines?.length) {
      setDetail(peekAdjustment);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void loadStockAdjustmentDetail(peekAdjustment.id).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        setError(result.error);
        setErrorAction(result.errorAction ?? null);
        return;
      }
      setDetail(result.adjustment);
    });

    return () => {
      cancelled = true;
    };
  }, [open, surface, peekAdjustment]);

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

  const addLine = () => {
    patchForm({ lines: [...form.lines, createEmptyLine()] });
  };

  const removeLine = (key: string) => {
    if (form.lines.length <= 1) return;
    patchForm({ lines: form.lines.filter((line) => line.key !== key) });
  };

  const handleSubmit = useCallback(() => {
    setError(null);
    setErrorAction(null);
    startTransition(async () => {
      const payload = {
        location_id: form.location_id,
        kind: form.kind,
        reason: form.reason,
        notes: form.notes || undefined,
        lines: form.lines.map((line) => ({
          variant_id: line.variant_id,
          quantity_delta: line.quantity_delta,
          unit_cost: line.unit_cost || "0",
          line_notes: line.line_notes || undefined,
        })),
      };

      const result = await postStockAdjustment(payload);
      if ("error" in result) {
        setError(result.error ?? "Unable to post adjustment.");
        setErrorAction(result.errorAction ?? null);
        return;
      }

      toast.success("Stock adjustment posted");
      closeForm();
      onAfterSave(result.adjustmentId);
    });
  }, [closeForm, form, onAfterSave]);

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
        title="Post (Ctrl+Enter)"
      >
        {isPending ? "Posting…" : "Post adjustment"}
      </Button>
    </>
  ) : null;

  if (!open || surface === "closed") return discardDialog;

  const showLoadingPeek = surface === "peek" && detailLoading && !detail?.lines?.length;

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
        <div className="flex min-h-0 flex-1 flex-col">
          {error ? (
            <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
              <UserFacingErrorMessage
                message={error}
                action={errorAction ?? undefined}
                className="text-sm"
              />
            </div>
          ) : null}

          {readOnly ? (
            showLoadingPeek ? (
              <p className="py-8 text-sm text-muted-foreground">Loading adjustment…</p>
            ) : detail ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Location
                    </p>
                    <p className="text-sm font-medium">{detail.location_name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Kind
                    </p>
                    <p className="text-sm">{stockAdjustmentKindLabel(detail.kind)}</p>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Reason
                    </p>
                    <p className="text-sm">{detail.reason}</p>
                  </div>
                  {detail.notes ? (
                    <div className="space-y-1 sm:col-span-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Notes
                      </p>
                      <p className="text-sm text-muted-foreground">{detail.notes}</p>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Posted
                    </p>
                    <p className="text-sm text-muted-foreground">{formatDate(detail.posted_at)}</p>
                  </div>
                </div>

                <div className="surface-inset overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="p-2.5 font-medium">Item</th>
                        <th className="p-2.5 font-medium">SKU</th>
                        <th className="p-2.5 text-right font-medium">Qty Δ</th>
                        <th className="p-2.5 text-right font-medium">Unit cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.lines ?? []).map((line) => (
                        <tr key={line.id} className="border-b border-border">
                          <td className="p-2.5 font-medium">{line.item_name}</td>
                          <td className="p-2.5 font-mono text-xs">{line.variant_sku}</td>
                          <td className="p-2.5 text-right tabular-nums">{line.quantity_delta}</td>
                          <td className="p-2.5 text-right tabular-nums">{line.unit_cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="py-8 text-sm text-muted-foreground">Adjustment not found.</p>
            )
          ) : (
            <div className="space-y-5">
              {locations.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  No active stock-holding locations are configured. Add one under Settings →
                  Locations before posting adjustments.
                </p>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Location</Label>
                  <Select
                    value={form.location_id}
                    disabled={isPending || locations.length === 0}
                    onValueChange={(value) => patchForm({ location_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                          {location.code ? ` (${location.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Kind</Label>
                  <Select
                    value={form.kind}
                    disabled={isPending}
                    onValueChange={(value) => patchForm({ kind: value as StockAdjustmentKind })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCK_ADJUSTMENT_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {stockAdjustmentKindLabel(kind)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="stock-reason" className="text-sm font-medium text-muted-foreground">
                    Reason
                  </Label>
                  <Input
                    id="stock-reason"
                    value={form.reason}
                    disabled={isPending}
                    placeholder="Cycle count variance, damaged goods, opening balance…"
                    onChange={(event) => patchForm({ reason: event.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="stock-notes" className="text-sm font-medium text-muted-foreground">
                    Notes (optional)
                  </Label>
                  <textarea
                    id="stock-notes"
                    value={form.notes}
                    disabled={isPending}
                    rows={2}
                    className="flex min-h-[4.5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    onChange={(event) => patchForm({ notes: event.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-sm font-semibold">Lines</h3>

                <div className="surface-inset overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="min-w-[12rem] p-2.5 font-medium">SKU</th>
                        <th className="w-28 p-2.5 font-medium">Qty Δ</th>
                        <th className="w-28 p-2.5 font-medium">Unit cost</th>
                        <th className="min-w-[8rem] p-2.5 font-medium">Notes</th>
                        <th className="w-10 p-2.5">
                          <span className="sr-only">Remove</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.lines.map((line) => (
                        <tr key={line.key} className="border-b border-border align-top">
                          <td className="p-2">
                            <StockVariantSkuField
                              compact
                              disabled={isPending}
                              value={line}
                              onChange={(patch) => patchLine(line.key, patch)}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              className="h-9 tabular-nums"
                              value={line.quantity_delta}
                              disabled={isPending}
                              placeholder="10"
                              aria-label="Quantity delta"
                              onChange={(event) =>
                                patchLine(line.key, { quantity_delta: event.target.value })
                              }
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              className="h-9 tabular-nums"
                              value={line.unit_cost}
                              disabled={isPending}
                              aria-label="Unit cost"
                              onChange={(event) =>
                                patchLine(line.key, { unit_cost: event.target.value })
                              }
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              className="h-9"
                              value={line.line_notes}
                              disabled={isPending}
                              placeholder="Optional"
                              aria-label="Line notes"
                              onChange={(event) =>
                                patchLine(line.key, { line_notes: event.target.value })
                              }
                            />
                          </td>
                          <td className="p-2">
                            {form.lines.length > 1 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 text-destructive hover:text-destructive"
                                disabled={isPending}
                                onClick={() => removeLine(line.key)}
                                aria-label="Remove line"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={isPending}
                  onClick={addLine}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add line
                </Button>
              </div>
            </div>
          )}
        </div>
      </RightDrawer>
      {discardDialog}
    </>
  );
}
