"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { loadStockAdjustmentDetail, postStockAdjustment } from "@/app/inventory/stock/actions";
import {
  createEmptyStockAdjustmentLine,
  filterSavableStockAdjustmentLines,
  StockAdjustmentLineEntryTable,
  type StockAdjustmentDraftLine,
} from "@/components/inventory/stock/stock-adjustment-line-entry-table";
import { DocumentActivityTimelinePanel } from "@/components/activity/document-activity-timeline-panel";
import {
  DocumentLinePeekItemCell,
  DocumentLinePeekTable,
  DocumentLinePeekValueCell,
} from "@/components/documents/document-line-peek-table";
import { RightDrawer, isNarrowRightDrawer, useRightDrawerLayout } from "@/components/ui/right-drawer";
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
import { ensureTrailingEmptyLine } from "@/lib/documents/line-entry";
import { useDocumentLineTableFillHeight } from "@/lib/documents/use-document-line-table-fill-height";
import { cn } from "@/lib/utils";

type CreateFormState = {
  location_id: string;
  kind: StockAdjustmentKind;
  reason: string;
  notes: string;
  lines: StockAdjustmentDraftLine[];
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

function defaultCreateForm(
  locations: StockLocationOption[],
  prefill?: StockDrawerCreatePrefill | null
): CreateFormState {
  const locationId =
    prefill?.location_id && locations.some((location) => location.id === prefill.location_id)
      ? prefill.location_id
      : (locations[0]?.id ?? "");

  const line = createEmptyStockAdjustmentLine();
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
    lines: ensureTrailingEmptyLine([line], () => false, createEmptyStockAdjustmentLine),
  };
}

function resolveDrawerTitle(surface: DrawerSurface, adjustment: StockAdjustmentRow | null): string {
  if (surface === "create") return "New stock adjustment";
  return adjustment?.adjustment_number ?? "Stock adjustment";
}

type StockAdjustmentMutateFormProps = {
  form: CreateFormState;
  locations: StockLocationOption[];
  lineTableFillHeight: boolean;
  isPending: boolean;
  onPatch: (patch: Partial<CreateFormState>) => void;
  onLinesChange: (
    lines:
      | StockAdjustmentDraftLine[]
      | ((current: StockAdjustmentDraftLine[]) => StockAdjustmentDraftLine[])
  ) => void;
};

function StockAdjustmentMutateForm({
  form,
  locations,
  lineTableFillHeight,
  isPending,
  onPatch,
  onLinesChange,
}: StockAdjustmentMutateFormProps) {
  const drawerLayout = useRightDrawerLayout();
  /** 40vw peek + mobile sheet: Location/Kind on one row, Reason below. */
  const compactHeader =
    drawerLayout?.isPartialDrawer !== true || isNarrowRightDrawer(drawerLayout);

  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        lineTableFillHeight && "h-full min-h-0 flex-1 overflow-hidden"
      )}
    >
      {locations.length === 0 ? (
        <p className="shrink-0 rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          No active stock-holding locations are configured. Add one under Settings → Locations
          before posting adjustments.
        </p>
      ) : null}

      <div
        className={cn(
          "grid shrink-0 gap-4",
          compactHeader ? "grid-cols-2" : "grid-cols-3"
        )}
      >
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Location</Label>
          <Select
            value={form.location_id}
            disabled={isPending || locations.length === 0}
            onValueChange={(value) => onPatch({ location_id: value })}
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
            onValueChange={(value) => onPatch({ kind: value as StockAdjustmentKind })}
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
        <div className={cn("space-y-2", compactHeader && "col-span-2")}>
          <Label htmlFor="stock-reason" className="text-sm font-medium text-muted-foreground">
            Reason
          </Label>
          <Input
            id="stock-reason"
            value={form.reason}
            disabled={isPending}
            placeholder="Cycle count variance, damaged goods…"
            onChange={(event) => onPatch({ reason: event.target.value })}
          />
        </div>
      </div>

      <div
        className={cn("min-h-0 min-w-0", lineTableFillHeight && "flex flex-1 flex-col")}
      >
        <StockAdjustmentLineEntryTable
          fillHeight={lineTableFillHeight}
          lines={form.lines}
          disabled={isPending}
          onChange={onLinesChange}
        />
      </div>

      <div className="shrink-0 space-y-2">
        <Label htmlFor="stock-notes" className="text-sm font-medium text-muted-foreground">
          Notes (optional)
        </Label>
        <textarea
          id="stock-notes"
          value={form.notes}
          disabled={isPending}
          rows={2}
          className="flex min-h-[4.5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          onChange={(event) => onPatch({ notes: event.target.value })}
        />
      </div>
    </div>
  );
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
  const lineTableFillHeight = useDocumentLineTableFillHeight(isMutating);
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

  const handleSubmit = useCallback(() => {
    setError(null);
    setErrorAction(null);
    startTransition(async () => {
      const payload = {
        location_id: form.location_id,
        kind: form.kind,
        reason: form.reason,
        notes: form.notes || undefined,
        lines: filterSavableStockAdjustmentLines(form.lines).map((line) => ({
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
    <Button
      type="button"
      size="sm"
      disabled={isPending || locations.length === 0}
      onClick={handleSubmit}
      title="Post (Ctrl+Enter)"
    >
      {isPending ? "Posting…" : "Post adjustment"}
    </Button>
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
        bodyClassName={isMutating ? "module-drawer-form-body" : undefined}
        scrollable={!(isMutating && lineTableFillHeight)}
        showCloseButton
      >
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            isMutating && lineTableFillHeight && "overflow-hidden"
          )}
        >
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

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Lines
                  </p>
                  <DocumentLinePeekTable
                    lines={detail.lines ?? []}
                    minTableWidth="min-w-[40rem]"
                    getRowKey={(line) => line.id}
                    columns={[
                      { id: "item", label: "Item", align: "left" },
                      { id: "quantity_delta", label: "Qty Δ", align: "right", widthClass: "w-[4.5rem]" },
                      { id: "unit_cost", label: "Unit cost", align: "right", widthClass: "w-[5.5rem]" },
                    ]}
                    renderCell={(column, line) => {
                      if (column.id === "item") {
                        return (
                          <DocumentLinePeekItemCell
                            itemName={line.item_name}
                            variantSku={line.variant_sku}
                          />
                        );
                      }
                      if (column.id === "quantity_delta") {
                        return <DocumentLinePeekValueCell value={line.quantity_delta} />;
                      }
                      return <DocumentLinePeekValueCell value={line.unit_cost} />;
                    }}
                  />
                </div>

                <DocumentActivityTimelinePanel
                  entityType="STOCK_ADJUSTMENT"
                  entityId={detail.id}
                  refreshKey={`${detail.id}:${detail.posted_at}`}
                />
              </div>
            ) : (
              <p className="py-8 text-sm text-muted-foreground">Adjustment not found.</p>
            )
          ) : (
            <StockAdjustmentMutateForm
              form={form}
              locations={locations}
              lineTableFillHeight={lineTableFillHeight}
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
          )}
        </div>
      </RightDrawer>
      {discardDialog}
    </>
  );
}
