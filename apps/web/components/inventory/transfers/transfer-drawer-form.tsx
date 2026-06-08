"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  cancelStockTransfer,
  dispatchStockTransfer,
  loadStockTransferDetail,
  receiveStockTransfer,
  saveStockTransfer,
} from "@/app/inventory/transfers/actions";
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
import { stockTransferStatusLabel } from "@/lib/inventory/transfers/labels";
import { validateReceiptLines } from "@/lib/inventory/transfers/receipt-validation";
import { formatDate } from "@/lib/dashboard/format";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import { isMutationSurface, type DrawerSurface } from "@/lib/layout/module-drawer-url";
import type {
  StockTransferRow,
  TransferDrawerCreatePrefill,
  TransferLineRow,
  TransferLocationOption,
} from "@/lib/inventory/transfers/types";

type DraftLine = {
  key: string;
  sku: string;
  variant_id: string;
  item_name: string;
  variant_sku: string;
  quantity_dispatched: string;
  skuError: string | null;
};

type ReceiptLine = {
  line_id: string;
  item_name: string;
  variant_sku: string;
  quantity_dispatched: string;
  quantity_accepted: string;
  quantity_damaged: string;
  quantity_lost: string;
};

type DraftFormState = {
  source_location_id: string;
  destination_location_id: string;
  inter_company_freight_cost: string;
  loading_overhead_cost: string;
  unloading_overhead_cost: string;
  lines: DraftLine[];
};

type Props = {
  open: boolean;
  surface: DrawerSurface;
  locations: TransferLocationOption[];
  peekTransfer: StockTransferRow | null;
  editTransferId: string | null;
  createPrefill?: TransferDrawerCreatePrefill | null;
  onClose: () => void;
  onAfterSave: (transferId: string) => void;
  onOpenEdit: (transferId: string) => void;
};

function createEmptyLine(): DraftLine {
  return {
    key: crypto.randomUUID(),
    sku: "",
    variant_id: "",
    item_name: "",
    variant_sku: "",
    quantity_dispatched: "",
    skuError: null,
  };
}

function defaultDraftForm(
  locations: TransferLocationOption[],
  prefill?: TransferDrawerCreatePrefill | null
): DraftFormState {
  const fallbackSourceId = locations[0]?.id ?? "";
  const fallbackDestinationId =
    locations.find((location) => location.id !== fallbackSourceId)?.id ?? "";

  const sourceId =
    prefill?.source_location_id &&
    locations.some((location) => location.id === prefill.source_location_id)
      ? prefill.source_location_id
      : fallbackSourceId;

  let destinationId =
    prefill?.destination_location_id &&
    locations.some((location) => location.id === prefill.destination_location_id)
      ? prefill.destination_location_id
      : fallbackDestinationId;

  if (destinationId === sourceId) {
    destinationId =
      locations.find((location) => location.id !== sourceId)?.id ?? destinationId;
  }

  const line = createEmptyLine();
  if (prefill?.variant_id) {
    line.variant_id = prefill.variant_id;
    line.variant_sku = prefill.variant_sku;
    line.sku = prefill.variant_sku;
    line.item_name = prefill.item_name;
  }

  return {
    source_location_id: sourceId,
    destination_location_id: destinationId,
    inter_company_freight_cost: "0",
    loading_overhead_cost: "0",
    unloading_overhead_cost: "0",
    lines: [line],
  };
}

function draftFormFromTransfer(
  transfer: StockTransferRow,
  locations: TransferLocationOption[]
): DraftFormState {
  return {
    source_location_id: transfer.source_location_id,
    destination_location_id: transfer.destination_location_id,
    inter_company_freight_cost: transfer.inter_company_freight_cost || "0",
    loading_overhead_cost: transfer.loading_overhead_cost || "0",
    unloading_overhead_cost: transfer.unloading_overhead_cost || "0",
    lines:
      transfer.lines?.map((line) => ({
        key: line.id,
        sku: line.variant_sku,
        variant_id: line.variant_id,
        item_name: line.item_name,
        variant_sku: line.variant_sku,
        quantity_dispatched: line.quantity_dispatched,
        skuError: null,
      })) ?? [createEmptyLine()],
  };
}

function receiptLinesFromTransfer(lines: TransferLineRow[]): ReceiptLine[] {
  return lines.map((line) => ({
    line_id: line.id,
    item_name: line.item_name,
    variant_sku: line.variant_sku,
    quantity_dispatched: line.quantity_dispatched,
    quantity_accepted: line.quantity_dispatched,
    quantity_damaged: "0",
    quantity_lost: "0",
  }));
}

function resolveDrawerTitle(
  surface: DrawerSurface,
  transfer: StockTransferRow | null
): string {
  if (surface === "create") return "New stock transfer";
  if (surface === "edit") return transfer?.transfer_number ?? "Edit transfer";
  return transfer?.transfer_number ?? "Stock transfer";
}

export function TransferDrawerForm({
  open,
  surface,
  locations,
  peekTransfer,
  editTransferId,
  createPrefill = null,
  onClose,
  onAfterSave,
  onOpenEdit,
}: Props) {
  const isDraftForm = surface === "create" || surface === "edit";
  const isMutating = isMutationSurface(surface);
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating,
  });

  const [form, setForm] = useState<DraftFormState>(() => defaultDraftForm(locations));
  const [receiptLines, setReceiptLines] = useState<ReceiptLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<UserFacingErrorAction | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState<StockTransferRow | null>(peekTransfer);
  const [detailLoading, setDetailLoading] = useState(false);
  const submitRef = useRef<() => void>(() => {});

  const activeTransferId = surface === "edit" ? editTransferId : peekTransfer?.id ?? null;

  const createPrefillSignature = createPrefill
    ? `${createPrefill.source_location_id}:${createPrefill.destination_location_id}:${createPrefill.variant_id}`
    : "";

  useEffect(() => {
    if (!open) return;
    setError(null);
    setErrorAction(null);
    setIsDirty(false);

    if (surface === "create") {
      setForm(defaultDraftForm(locations, createPrefill));
      setDetail(null);
      return;
    }

    setDetail(peekTransfer);
  }, [open, surface, peekTransfer?.id, locations, createPrefillSignature, createPrefill]);

  useEffect(() => {
    if (!open || surface !== "edit" || !editTransferId) return;

    let cancelled = false;
    setDetailLoading(true);
    void loadStockTransferDetail(editTransferId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDetail(result.transfer);
      setForm(draftFormFromTransfer(result.transfer, locations));
    });

    return () => {
      cancelled = true;
    };
  }, [editTransferId, locations, open, surface]);

  useEffect(() => {
    if (!open || surface !== "peek" || !peekTransfer?.id) return;
    if (peekTransfer.lines?.length) {
      setDetail(peekTransfer);
      if (peekTransfer.current_status === "DISPATCHED_IN_TRANSIT") {
        setReceiptLines(receiptLinesFromTransfer(peekTransfer.lines));
      }
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void loadStockTransferDetail(peekTransfer.id).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDetail(result.transfer);
      if (result.transfer.current_status === "DISPATCHED_IN_TRANSIT" && result.transfer.lines) {
        setReceiptLines(receiptLinesFromTransfer(result.transfer.lines));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, peekTransfer, surface]);

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
        transfer_id: surface === "edit" ? editTransferId : undefined,
        source_location_id: form.source_location_id,
        destination_location_id: form.destination_location_id,
        inter_company_freight_cost: form.inter_company_freight_cost,
        loading_overhead_cost: form.loading_overhead_cost,
        unloading_overhead_cost: form.unloading_overhead_cost,
        lines: form.lines.map((line) => ({
          variant_id: line.variant_id,
          quantity_dispatched: line.quantity_dispatched,
        })),
      };

      const result = await saveStockTransfer(payload);
      if ("error" in result) {
        setError(result.error ?? "Unable to save transfer.");
        setErrorAction(result.errorAction ?? null);
        return;
      }

      toast.success(surface === "edit" ? "Transfer updated" : "Transfer draft saved");
      closeForm();
      onAfterSave(result.transferId);
    });
  }, [closeForm, editTransferId, form, onAfterSave, surface]);

  const handleDispatch = useCallback(() => {
    if (!activeTransferId) return;
    setError(null);
    setErrorAction(null);
    startTransition(async () => {
      const result = await dispatchStockTransfer(activeTransferId);
      if ("error" in result) {
        setError(result.error ?? "Unable to dispatch transfer.");
        setErrorAction(result.errorAction ?? null);
        return;
      }
      toast.success("Transfer dispatched");
      closeForm();
      onAfterSave(result.transferId);
    });
  }, [activeTransferId, closeForm, onAfterSave]);

  const handleReceive = useCallback(() => {
    if (!activeTransferId) return;
    setError(null);
    setErrorAction(null);

    const receiptError = validateReceiptLines(
      receiptLines.map((line) => ({
        line_id: line.line_id,
        variant_sku: line.variant_sku,
        quantity_dispatched: line.quantity_dispatched,
        quantity_accepted: line.quantity_accepted,
        quantity_damaged: line.quantity_damaged,
        quantity_lost: line.quantity_lost,
      }))
    );
    if (receiptError) {
      setError(receiptError);
      return;
    }

    const dispatchedByLineId = Object.fromEntries(
      receiptLines.map((line) => [line.line_id, line.quantity_dispatched])
    );

    startTransition(async () => {
      const result = await receiveStockTransfer({
        transfer_id: activeTransferId,
        dispatched_by_line_id: dispatchedByLineId,
        lines: receiptLines.map((line) => ({
          line_id: line.line_id,
          quantity_accepted: line.quantity_accepted,
          quantity_damaged: line.quantity_damaged,
          quantity_lost: line.quantity_lost,
        })),
      });
      if ("error" in result) {
        setError(result.error ?? "Unable to receive transfer.");
        setErrorAction(result.errorAction ?? null);
        return;
      }
      toast.success("Transfer received");
      closeForm();
      onAfterSave(result.transferId);
    });
  }, [activeTransferId, closeForm, onAfterSave, receiptLines]);

  const handleCancel = useCallback(() => {
    if (!activeTransferId) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelStockTransfer(activeTransferId);
      if ("error" in result) {
        setError(result.error ?? "Unable to cancel transfer.");
        return;
      }
      toast.success("Transfer cancelled");
      closeForm();
      onAfterSave(result.transferId);
    });
  }, [activeTransferId, closeForm, onAfterSave]);

  submitRef.current = handleSaveDraft;

  useEffect(() => {
    if (!open || !isDraftForm) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        submitRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDraftForm, open]);

  const destinationOptions = locations.filter(
    (location) => location.id !== form.source_location_id
  );

  const headerActions = isDraftForm ? (
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
        disabled={isPending || locations.length < 2}
        onClick={handleSaveDraft}
        title="Save draft (Ctrl+Enter)"
      >
        {isPending ? "Saving…" : "Save draft"}
      </Button>
    </>
  ) : detail?.current_status === "DRAFT" ? (
    <>
      <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={handleCancel}>
        Cancel transfer
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => detail && onOpenEdit(detail.id)}
      >
        Edit
      </Button>
      <Button type="button" size="sm" disabled={isPending} onClick={handleDispatch}>
        {isPending ? "Dispatching…" : "Dispatch"}
      </Button>
    </>
  ) : detail?.current_status === "DISPATCHED_IN_TRANSIT" ? (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => handleRequestClose()}
      >
        Close
      </Button>
      <Button type="button" size="sm" disabled={isPending} onClick={handleReceive}>
        {isPending ? "Receiving…" : "Confirm receipt"}
      </Button>
    </>
  ) : null;

  if (!open || surface === "closed") return discardDialog;

  const showLoadingPeek =
    (surface === "peek" || surface === "edit") && detailLoading && !detail?.lines?.length;

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
            action={errorAction}
            className="mb-4"
          />
        ) : null}

        {isDraftForm ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="transfer-source">Source location</Label>
                <Select
                  value={form.source_location_id}
                  onValueChange={(value) => {
                    const nextDestination =
                      value === form.destination_location_id
                        ? (locations.find((location) => location.id !== value)?.id ?? "")
                        : form.destination_location_id;
                    patchForm({
                      source_location_id: value,
                      destination_location_id: nextDestination,
                    });
                  }}
                >
                  <SelectTrigger id="transfer-source">
                    <SelectValue placeholder="Select source" />
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
                <Label htmlFor="transfer-destination">Destination location</Label>
                <Select
                  value={form.destination_location_id}
                  onValueChange={(value) => patchForm({ destination_location_id: value })}
                >
                  <SelectTrigger id="transfer-destination">
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationOptions.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                        {location.code ? ` (${location.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border/80 p-3">
              <div>
                <Label>Transfer overhead (optional)</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Freight and handling costs are allocated to received stock when the transfer is
                  confirmed.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="transfer-freight">Freight</Label>
                  <Input
                    id="transfer-freight"
                    inputMode="decimal"
                    value={form.inter_company_freight_cost}
                    onChange={(event) =>
                      patchForm({ inter_company_freight_cost: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transfer-loading">Loading</Label>
                  <Input
                    id="transfer-loading"
                    inputMode="decimal"
                    value={form.loading_overhead_cost}
                    onChange={(event) =>
                      patchForm({ loading_overhead_cost: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transfer-unloading">Unloading</Label>
                  <Input
                    id="transfer-unloading"
                    inputMode="decimal"
                    value={form.unloading_overhead_cost}
                    onChange={(event) =>
                      patchForm({ unloading_overhead_cost: event.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label>Lines</Label>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addLine}>
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add line
                </Button>
              </div>

              {form.lines.map((line) => (
                <div
                  key={line.key}
                  className="space-y-3 rounded-lg border border-border/80 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-3">
                      <StockVariantSkuField
                        value={{
                          sku: line.sku,
                          variant_id: line.variant_id,
                          item_name: line.item_name,
                          variant_sku: line.variant_sku,
                          unit_cost: "0",
                          skuError: line.skuError,
                        }}
                        onChange={(patch) => patchLine(line.key, patch)}
                      />
                      <div className="space-y-2">
                        <Label htmlFor={`qty-${line.key}`}>Quantity to transfer</Label>
                        <Input
                          id={`qty-${line.key}`}
                          inputMode="decimal"
                          value={line.quantity_dispatched}
                          onChange={(event) =>
                            patchLine(line.key, { quantity_dispatched: event.target.value })
                          }
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {form.lines.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground"
                        onClick={() => removeLine(line.key)}
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : showLoadingPeek ? (
          <p className="text-sm text-muted-foreground">Loading transfer…</p>
        ) : detail ? (
          <div className="space-y-5">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Status</div>
                <div className="font-medium">{stockTransferStatusLabel(detail.current_status)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Created</div>
                <div>{formatDate(detail.created_at)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">From</div>
                <div className="font-medium">{detail.source_location_name}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">To</div>
                <div className="font-medium">{detail.destination_location_name}</div>
              </div>
              {detail.dispatched_at ? (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Dispatched
                  </div>
                  <div>{formatDate(detail.dispatched_at)}</div>
                </div>
              ) : null}
              {detail.received_at ? (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Received
                  </div>
                  <div>{formatDate(detail.received_at)}</div>
                </div>
              ) : null}
            </div>

            {Number(detail.inter_company_freight_cost) > 0 ||
            Number(detail.loading_overhead_cost) > 0 ||
            Number(detail.unloading_overhead_cost) > 0 ? (
              <div className="rounded-lg border border-border/80 p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Transfer overhead
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div>
                    <span className="text-muted-foreground">Freight: </span>
                    <span className="tabular-nums">{detail.inter_company_freight_cost}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Loading: </span>
                    <span className="tabular-nums">{detail.loading_overhead_cost}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Unloading: </span>
                    <span className="tabular-nums">{detail.unloading_overhead_cost}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {detail.current_status === "DISPATCHED_IN_TRANSIT" && receiptLines.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <Label>Receipt quantities</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Accepted + damaged + lost must equal dispatched quantity on every line.
                  </p>
                </div>
                {receiptLines.map((line) => (
                  <div
                    key={line.line_id}
                    className="space-y-3 rounded-lg border border-border/80 p-3"
                  >
                    <div>
                      <div className="font-medium">{line.item_name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{line.variant_sku}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Dispatched: {line.quantity_dispatched}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor={`accepted-${line.line_id}`}>Accepted</Label>
                        <Input
                          id={`accepted-${line.line_id}`}
                          inputMode="decimal"
                          value={line.quantity_accepted}
                          onChange={(event) =>
                            setReceiptLines((current) =>
                              current.map((row) =>
                                row.line_id === line.line_id
                                  ? { ...row, quantity_accepted: event.target.value }
                                  : row
                              )
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`damaged-${line.line_id}`}>Damaged</Label>
                        <Input
                          id={`damaged-${line.line_id}`}
                          inputMode="decimal"
                          value={line.quantity_damaged}
                          onChange={(event) =>
                            setReceiptLines((current) =>
                              current.map((row) =>
                                row.line_id === line.line_id
                                  ? { ...row, quantity_damaged: event.target.value }
                                  : row
                              )
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`lost-${line.line_id}`}>Lost</Label>
                        <Input
                          id={`lost-${line.line_id}`}
                          inputMode="decimal"
                          value={line.quantity_lost}
                          onChange={(event) =>
                            setReceiptLines((current) =>
                              current.map((row) =>
                                row.line_id === line.line_id
                                  ? { ...row, quantity_lost: event.target.value }
                                  : row
                              )
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : detail.lines && detail.lines.length > 0 ? (
              <div className="space-y-2">
                <Label>Lines</Label>
                <div className="overflow-hidden rounded-lg border border-border/80">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="p-2 text-left font-medium">SKU</th>
                        <th className="p-2 text-right font-medium">Dispatched</th>
                        {detail.current_status !== "DRAFT" ? (
                          <>
                            <th className="p-2 text-right font-medium">Accepted</th>
                            <th className="p-2 text-right font-medium">Damaged</th>
                            <th className="p-2 text-right font-medium">Lost</th>
                          </>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((line) => (
                        <tr key={line.id} className="border-t border-border/80">
                          <td className="p-2">
                            <div className="font-medium">{line.item_name}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {line.variant_sku}
                            </div>
                          </td>
                          <td className="p-2 text-right tabular-nums">{line.quantity_dispatched}</td>
                          {detail.current_status !== "DRAFT" ? (
                            <>
                              <td className="p-2 text-right tabular-nums">
                                {line.quantity_accepted}
                              </td>
                              <td className="p-2 text-right tabular-nums">
                                {line.quantity_damaged}
                              </td>
                              <td className="p-2 text-right tabular-nums">{line.quantity_lost}</td>
                            </>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Transfer not found.</p>
        )}
      </RightDrawer>
      {discardDialog}
    </>
  );
}
