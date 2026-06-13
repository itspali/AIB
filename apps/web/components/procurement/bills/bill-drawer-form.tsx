"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  applyPurchasePriceVariance,
  loadBillingGrnsForPo,
  loadPurchaseBillDetail,
  savePurchaseBill,
} from "@/app/procurement/bills/actions";
import { BillGrnLinkPanel } from "@/components/procurement/bills/bill-grn-link-panel";
import { BillLineEntryTable } from "@/components/procurement/bills/bill-line-entry-table";
import { BillPeekView } from "@/components/procurement/bills/bill-peek-view";
import { DocumentPostingSummaryPanel } from "@/components/documents/document-posting-summary-panel";
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
import { UserFacingErrorMessage } from "@/components/ui/user-facing-error-message";
import {
  buildBillDraftLinesFromPo,
  defaultSelectedGrnIdsForPo,
  filterSavableBillDraftLines,
  type BillDraftLine,
} from "@/lib/procurement/bills/bill-draft-form";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";
import type { PostingStepResult } from "@/lib/documents/posting-types";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import type { BillablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";
import { useDocumentLineTableFillHeight } from "@/lib/documents/use-document-line-table-fill-height";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  suppliers: ProcurementSupplierOption[];
  locations: ProcurementLocationOption[];
  billableOrders: BillablePurchaseOrderOption[];
  matchingTolerancePct: number;
  peekBill: PurchaseBillRow | null;
  onClose: () => void;
  onAfterSave: () => void;
};

type CreateFormState = {
  supplier_id: string;
  billing_location_id: string;
  purchase_order_id: string | null;
  invoice_number_vendor: string;
  selected_grn_ids: string[];
  lines: BillDraftLine[];
};

function defaultCreateForm(
  suppliers: ProcurementSupplierOption[],
  locations: ProcurementLocationOption[]
): CreateFormState {
  return {
    supplier_id: suppliers[0]?.id ?? "",
    billing_location_id: locations[0]?.id ?? "",
    purchase_order_id: null,
    invoice_number_vendor: "",
    selected_grn_ids: [],
    lines: [],
  };
}

export function BillDrawerForm({
  open,
  suppliers,
  locations,
  billableOrders,
  matchingTolerancePct,
  peekBill,
  onClose,
  onAfterSave,
}: Props) {
  const readOnly = Boolean(peekBill);
  const lineTableFillHeight = useDocumentLineTableFillHeight(!readOnly);

  const [form, setForm] = useState<CreateFormState>(() =>
    defaultCreateForm(suppliers, locations)
  );
  const [poGrns, setPoGrns] = useState<GoodsReceiptRow[]>([]);
  const [detail, setDetail] = useState<PurchaseBillRow | null>(peekBill);
  const [detailLoading, setDetailLoading] = useState(false);
  const [grnsLoading, setGrnsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postingSummary, setPostingSummary] = useState<{
    steps: PostingStepResult[];
    overall: "success" | "failure";
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedPo = useMemo(
    () => billableOrders.find((order) => order.id === form.purchase_order_id) ?? null,
    [billableOrders, form.purchase_order_id]
  );

  const filteredOrders = useMemo(() => {
    if (!form.supplier_id) return billableOrders;
    return billableOrders.filter((order) => order.supplier_id === form.supplier_id);
  }, [billableOrders, form.supplier_id]);

  const patchForm = useCallback((patch: Partial<CreateFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPostingSummary(null);
    setDetail(peekBill);
    if (!peekBill) {
      setForm(defaultCreateForm(suppliers, locations));
      setPoGrns([]);
    }
  }, [open, peekBill, suppliers, locations]);

  useEffect(() => {
    if (!open || !peekBill?.id) return;
    if (peekBill.lines?.length) {
      setDetail(peekBill);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void loadPurchaseBillDetail(peekBill.id).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDetail(result.bill);
    });

    return () => {
      cancelled = true;
    };
  }, [open, peekBill]);

  useEffect(() => {
    if (!open || readOnly || !form.purchase_order_id) {
      setPoGrns([]);
      return;
    }

    let cancelled = false;
    setGrnsLoading(true);
    void loadBillingGrnsForPo(form.purchase_order_id).then((result) => {
      if (cancelled) return;
      setGrnsLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const grns = result.grns;
      setPoGrns(grns);
      const defaultIds = defaultSelectedGrnIdsForPo(grns, form.purchase_order_id!);
      setForm((current) => {
        const order = billableOrders.find((row) => row.id === current.purchase_order_id);
        if (!order) return current;
        return {
          ...current,
          selected_grn_ids: defaultIds,
          lines: buildBillDraftLinesFromPo(order, grns, defaultIds),
        };
      });
    });

    return () => {
      cancelled = true;
    };
  }, [open, readOnly, form.purchase_order_id, billableOrders]);

  const handlePoChange = (value: string) => {
    if (value === "none") {
      patchForm({ purchase_order_id: null, selected_grn_ids: [], lines: [] });
      setPoGrns([]);
      return;
    }

    const order = billableOrders.find((row) => row.id === value);
    if (!order) return;

    patchForm({
      purchase_order_id: order.id,
      billing_location_id: order.destination_location_id,
      selected_grn_ids: [],
      lines: [],
    });
  };

  const handleGrnSelectionChange = (selected_grn_ids: string[]) => {
    if (!selectedPo) {
      patchForm({ selected_grn_ids });
      return;
    }
    patchForm({
      selected_grn_ids,
      lines: buildBillDraftLinesFromPo(selectedPo, poGrns, selected_grn_ids),
    });
  };

  const handleSave = useCallback(() => {
    setError(null);
    const savableLines = filterSavableBillDraftLines(form.lines);
    if (!form.supplier_id || !form.billing_location_id || !form.invoice_number_vendor.trim()) {
      setError("Supplier, billing location, and vendor invoice number are required.");
      return;
    }
    if (!form.purchase_order_id) {
      setError("Select a purchase order with received lines to bill.");
      return;
    }
    if (savableLines.length === 0) {
      setError("Add at least one bill line with quantity.");
      return;
    }

    startTransition(async () => {
      const result = await savePurchaseBill({
        supplier_id: form.supplier_id,
        billing_location_id: form.billing_location_id,
        invoice_number_vendor: form.invoice_number_vendor.trim(),
        purchase_order_id: form.purchase_order_id,
        currency_code: selectedPo?.currency_code ?? null,
        goods_receipt_ids: form.selected_grn_ids,
        lines: savableLines.map((line) => ({
          variant_id: line.variant_id,
          purchase_order_item_id: line.po_item_id,
          quantity_billed: line.quantity_billed,
          unit_price_billed: line.unit_price_billed,
        })),
      });

      if ("error" in result) {
        setError(result.error ?? "Unable to save bill.");
        return;
      }

      if (result.match_status === "PPV_HOLD") {
        toast.warning("Bill saved on PPV hold — price exceeds tolerance.");
      } else {
        toast.success("Supplier bill saved");
      }

      setPostingSummary({
        steps: result.steps ?? [],
        overall: result.overall === "failure" ? "failure" : "success",
      });
      onAfterSave();
    });
  }, [form, onAfterSave, selectedPo?.currency_code]);

  const handleApplyPpv = useCallback(() => {
    if (!detail?.id) return;
    setError(null);
    startTransition(async () => {
      const result = await applyPurchasePriceVariance(detail.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      toast.success("Purchase price variance applied");
      const refreshed = await loadPurchaseBillDetail(detail.id);
      if ("bill" in refreshed) {
        setDetail(refreshed.bill);
      }
      setPostingSummary({
        steps: result.steps ?? [],
        overall: result.overall === "failure" ? "failure" : "success",
      });
      onAfterSave();
    });
  }, [detail?.id, onAfterSave]);

  const headerActions = readOnly ? (
    detail?.match_status === "PPV_HOLD" ? (
      <Button size="sm" disabled={isPending} onClick={handleApplyPpv}>
        {isPending ? "Applying…" : "Apply PPV"}
      </Button>
    ) : (
      <Button size="sm" onClick={onClose}>
        Close
      </Button>
    )
  ) : postingSummary ? (
    <Button size="sm" onClick={onClose}>
      Close
    </Button>
  ) : (
    <Button size="sm" disabled={isPending} onClick={handleSave}>
      {isPending ? "Saving…" : "Save bill"}
    </Button>
  );

  return (
    <RightDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      onRequestClose={onClose}
      title={detail?.system_voucher_number ?? peekBill?.system_voucher_number ?? "New supplier bill"}
      headerActions={headerActions}
      bodyClassName={!readOnly ? "module-drawer-form-body" : undefined}
      scrollable={!( !readOnly && lineTableFillHeight )}
    >
      {error ? <UserFacingErrorMessage message={error} className="mb-4" /> : null}

      {postingSummary?.steps.length ? (
        <DocumentPostingSummaryPanel
          steps={postingSummary.steps}
          overall={postingSummary.overall}
          className="mb-4"
        />
      ) : null}

      {readOnly ? (
        detailLoading && !detail?.lines?.length ? (
          <p className="text-sm text-muted-foreground">Loading bill…</p>
        ) : detail ? (
          <BillPeekView bill={detail} matchingTolerancePct={matchingTolerancePct} />
        ) : null
      ) : postingSummary ? null : (
        <div
          className={cn(
            "flex flex-col gap-5",
            lineTableFillHeight && "h-full min-h-0 flex-1 overflow-hidden pb-20"
          )}
        >
          <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select
                value={form.supplier_id}
                onValueChange={(supplier_id) =>
                  patchForm({
                    supplier_id,
                    purchase_order_id: null,
                    selected_grn_ids: [],
                    lines: [],
                  })
                }
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
            <div className="space-y-2">
              <Label>Billing location</Label>
              <Select
                value={form.billing_location_id}
                onValueChange={(billing_location_id) => patchForm({ billing_location_id })}
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
            <div className="space-y-2 sm:col-span-2">
              <Label>Purchase order</Label>
              <Select
                value={form.purchase_order_id ?? "none"}
                onValueChange={handlePoChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select purchase order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select purchase order</SelectItem>
                  {filteredOrders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.voucher_number} · {order.supplier_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Vendor invoice number</Label>
              <Input
                value={form.invoice_number_vendor}
                onChange={(event) => patchForm({ invoice_number_vendor: event.target.value })}
              />
            </div>
          </div>

          {form.purchase_order_id ? (
            grnsLoading ? (
              <p className="text-sm text-muted-foreground">Loading goods receipts…</p>
            ) : (
              <BillGrnLinkPanel
                grns={poGrns}
                selectedIds={form.selected_grn_ids}
                disabled={isPending}
                onChange={handleGrnSelectionChange}
              />
            )
          ) : null}

          {form.lines.length > 0 ? (
            <div className={cn("min-h-0 min-w-0", lineTableFillHeight && "flex flex-1 flex-col")}>
              <BillLineEntryTable
                lines={form.lines}
                matchingTolerancePct={matchingTolerancePct}
                disabled={isPending}
                fillHeight={lineTableFillHeight}
                onChange={(linesOrUpdater) => {
                  setForm((current) => ({
                    ...current,
                    lines:
                      typeof linesOrUpdater === "function"
                        ? linesOrUpdater(current.lines)
                        : linesOrUpdater,
                  }));
                }}
              />
            </div>
          ) : form.purchase_order_id && !grnsLoading ? (
            <p className="text-sm text-muted-foreground">
              No billable received lines on this purchase order.
            </p>
          ) : null}
        </div>
      )}
    </RightDrawer>
  );
}
