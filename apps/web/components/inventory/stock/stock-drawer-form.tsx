"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  loadStockAdjustmentDetail,
  lookupStockVariantBySku,
  postStockAdjustment,
} from "@/app/inventory/stock/actions";
import { RightDrawer } from "@/components/ui/right-drawer";
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

type Props = {
  open: boolean;
  surface: DrawerSurface;
  locations: StockLocationOption[];
  peekAdjustment: StockAdjustmentRow | null;
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

function defaultCreateForm(locations: StockLocationOption[]): CreateFormState {
  return {
    location_id: locations[0]?.id ?? "",
    kind: "CORRECTION",
    reason: "",
    notes: "",
    lines: [createEmptyLine()],
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
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState<StockAdjustmentRow | null>(peekAdjustment);
  const [detailLoading, setDetailLoading] = useState(false);
  const submitRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!open) return;
    setForm(defaultCreateForm(locations));
    setError(null);
    setIsDirty(false);
    setDetail(peekAdjustment);
  }, [open, surface, peekAdjustment?.id, locations]);

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

  const resolveSku = useCallback(
    async (key: string, sku: string) => {
      const trimmed = sku.trim();
      if (!trimmed) {
        patchLine(key, {
          variant_id: "",
          item_name: "",
          variant_sku: "",
          skuError: null,
        });
        return;
      }

      const result = await lookupStockVariantBySku(trimmed);
      if ("error" in result) {
        patchLine(key, {
          variant_id: "",
          item_name: "",
          variant_sku: "",
          skuError: result.error,
        });
        return;
      }

      patchLine(key, {
        variant_id: result.variant.variant_id,
        item_name: result.variant.item_name,
        variant_sku: result.variant.variant_sku,
        unit_cost: result.variant.standard_cost ?? "0",
        skuError: null,
      });
    },
    [patchLine]
  );

  const addLine = () => {
    patchForm({ lines: [...form.lines, createEmptyLine()] });
  };

  const removeLine = (key: string) => {
    if (form.lines.length <= 1) return;
    patchForm({ lines: form.lines.filter((line) => line.key !== key) });
  };

  const handleSubmit = useCallback(() => {
    setError(null);
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
            <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
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

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Lines</h3>
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

                <div className="space-y-3">
                  {form.lines.map((line, index) => (
                    <div
                      key={line.key}
                      className="rounded-lg border border-border/80 border-black/[0.06] p-3 dark:border-white/10"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Line {index + 1}
                        </p>
                        {form.lines.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            disabled={isPending}
                            onClick={() => removeLine(line.key)}
                            aria-label="Remove line"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </Button>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-sm font-medium text-muted-foreground">SKU</Label>
                          <Input
                            className="font-mono"
                            value={line.sku}
                            disabled={isPending}
                            placeholder="Scan or enter SKU"
                            onChange={(event) =>
                              patchLine(line.key, { sku: event.target.value, skuError: null })
                            }
                            onBlur={() => void resolveSku(line.key, line.sku)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void resolveSku(line.key, line.sku);
                              }
                            }}
                          />
                          {line.skuError ? (
                            <p className="text-xs text-destructive">{line.skuError}</p>
                          ) : line.variant_id ? (
                            <p className="text-xs text-muted-foreground">{line.item_name}</p>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-muted-foreground">
                            Quantity Δ
                          </Label>
                          <Input
                            className="tabular-nums"
                            value={line.quantity_delta}
                            disabled={isPending}
                            placeholder="e.g. 10 or -2"
                            onChange={(event) =>
                              patchLine(line.key, { quantity_delta: event.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-muted-foreground">
                            Unit cost
                          </Label>
                          <Input
                            className="tabular-nums"
                            value={line.unit_cost}
                            disabled={isPending}
                            onChange={(event) =>
                              patchLine(line.key, { unit_cost: event.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-sm font-medium text-muted-foreground">
                            Line notes (optional)
                          </Label>
                          <Input
                            value={line.line_notes}
                            disabled={isPending}
                            onChange={(event) =>
                              patchLine(line.key, { line_notes: event.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </RightDrawer>
      {discardDialog}
    </>
  );
}
