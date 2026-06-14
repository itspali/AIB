"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  applyPurchasePriceVariance,
  loadBillingGrnsForPo,
  loadPurchaseBillDetail,
  savePurchaseBill,
  voidPurchaseBill,
} from "@/app/procurement/bills/actions";
import { BillAdvanceApplicationPanel } from "@/components/procurement/bills/bill-advance-application-panel";
import { BillGrnLinkPanel } from "@/components/procurement/bills/bill-grn-link-panel";
import { BillLineEntryTable } from "@/components/procurement/bills/bill-line-entry-table";
import { BillPaymentPanel } from "@/components/procurement/bills/bill-payment-panel";
import { BillPeekView } from "@/components/procurement/bills/bill-peek-view";
import { DocumentPrintButton } from "@/components/documents/document-print-button";
import { DocumentPostingSummaryPanel } from "@/components/documents/document-posting-summary-panel";
import { RightDrawer } from "@/components/ui/right-drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  validateBillDraftLineQuantities,
  type BillDraftLine,
} from "@/lib/procurement/bills/bill-draft-form";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";
import type { PostingStepResult } from "@/lib/documents/posting-types";
import type { DrawerSurface } from "@/lib/layout/module-drawer-url";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import type { BillablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";
import { useDocumentLineTableFillHeight } from "@/lib/documents/use-document-line-table-fill-height";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  surface: DrawerSurface;
  suppliers: ProcurementSupplierOption[];
  locations: ProcurementLocationOption[];
  billableOrders: BillablePurchaseOrderOption[];
  matchingTolerancePct: number;
  peekBill: PurchaseBillRow | null;
  peekRecordId: string | null;
  editBillId: string | null;
  createPrefillPoId?: string | null;
  onClose: () => void;
  onAfterSave: (billId: string) => void;
  onOpenEdit?: (billId: string) => void;
  onEditNotAllowed?: (billId: string) => void;
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
  surface,
  suppliers,
  locations,
  billableOrders,
  matchingTolerancePct,
  peekBill,
  peekRecordId,
  editBillId,
  createPrefillPoId = null,
  onClose,
  onAfterSave,
  onOpenEdit,
  onEditNotAllowed,
}: Props) {
  const readOnly = surface === "peek";
  const isEditing = surface === "edit";
  const isCreating = surface === "create";
  const isMutating = isCreating || isEditing;
  const lineTableFillHeight = useDocumentLineTableFillHeight(isMutating);
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating,
  });

  const [form, setForm] = useState<CreateFormState>(() =>
    defaultCreateForm(suppliers, locations)
  );
  const [isDirty, setIsDirty] = useState(false);
  const [poGrns, setPoGrns] = useState<GoodsReceiptRow[]>([]);
  const [detail, setDetail] = useState<PurchaseBillRow | null>(peekBill);
  const [detailLoading, setDetailLoading] = useState(false);
  const [grnsLoading, setGrnsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postingSummary, setPostingSummary] = useState<{
    steps: PostingStepResult[];
    overall: "success" | "failure";
  } | null>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
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
    setIsDirty(true);
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  const closeForm = useCallback(() => {
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

  const reloadDetail = useCallback(() => {
    if (!detail?.id) return;
    void loadPurchaseBillDetail(detail.id).then((result) => {
      if ("error" in result) {
        setError(result.error ?? "Request failed.");
        return;
      }
      setDetail(result.bill);
      onAfterSave(result.bill.id);
    });
  }, [detail?.id, onAfterSave]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPostingSummary(null);
    if (surface === "peek") {
      setDetail(peekBill);
    } else if (surface === "create") {
      setDetail(null);
      setIsDirty(false);
      const baseForm = defaultCreateForm(suppliers, locations);
      const prefillOrder = createPrefillPoId
        ? billableOrders.find((row) => row.id === createPrefillPoId)
        : null;
      setForm(
        prefillOrder
          ? {
              ...baseForm,
              supplier_id: prefillOrder.supplier_id,
              billing_location_id: prefillOrder.destination_location_id,
              purchase_order_id: prefillOrder.id,
            }
          : baseForm
      );
      setPoGrns([]);
    } else if (surface === "edit") {
      setDetail(null);
      setIsDirty(false);
    }
  }, [billableOrders, createPrefillPoId, open, peekBill, surface, suppliers, locations]);

  useEffect(() => {
    if (!open || surface !== "peek" || !peekRecordId) return;
    if (peekBill?.lines?.length) {
      setDetail(peekBill);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void loadPurchaseBillDetail(peekRecordId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        setError(result.error ?? "Request failed.");
        return;
      }
      setDetail(result.bill);
    });

    return () => {
      cancelled = true;
    };
  }, [open, peekBill, peekRecordId, surface]);

  useEffect(() => {
    if (!open || surface !== "edit" || !editBillId) return;

    let cancelled = false;
    setDetailLoading(true);
    void loadPurchaseBillDetail(editBillId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        setError(result.error ?? "Request failed.");
        return;
      }
      const bill = result.bill;
      if (bill.is_paid) {
        onEditNotAllowed?.(bill.id);
        return;
      }
      setDetail(bill);
      setForm({
        supplier_id: bill.supplier_id,
        billing_location_id: bill.billing_location_id ?? locations[0]?.id ?? "",
        purchase_order_id: bill.purchase_order_id,
        invoice_number_vendor: bill.invoice_number_vendor,
        selected_grn_ids: bill.linked_goods_receipts?.map((grn) => grn.id) ?? [],
        lines: [],
      });
    });

    return () => {
      cancelled = true;
    };
  }, [editBillId, locations, onEditNotAllowed, open, surface]);

  useEffect(() => {
    if (!open || readOnly || !form.purchase_order_id) {
      if (!isEditing) setPoGrns([]);
      return;
    }

    let cancelled = false;
    setGrnsLoading(true);
    void loadBillingGrnsForPo(form.purchase_order_id).then((result) => {
      if (cancelled) return;
      setGrnsLoading(false);
      if ("error" in result) {
        setError(result.error ?? "Request failed.");
        return;
      }
      const grns = result.grns;
      setPoGrns(grns);
      const defaultIds = defaultSelectedGrnIdsForPo(grns, form.purchase_order_id!);
      setForm((current) => {
        const order = billableOrders.find((row) => row.id === current.purchase_order_id);
        if (!order) return current;

        const selectedIds =
          current.selected_grn_ids.length > 0 ? current.selected_grn_ids : defaultIds;
        const draftLines = buildBillDraftLinesFromPo(order, grns, selectedIds);

        if (isEditing && detail?.lines?.length) {
          const mergedLines = draftLines
            .map((draft) => {
              const saved = detail.lines?.find(
                (line) => line.purchase_order_item_id === draft.po_item_id
              );
              if (!saved) return draft;
              const poLine = order.lines.find((line) => line.id === draft.po_item_id);
              const invoicedOnPo = Number(poLine?.quantity_invoiced ?? 0);
              const thisBillQty = Number(saved.quantity_billed);
              const alreadyExcludingThis = Math.max(invoicedOnPo - thisBillQty, 0);
              return {
                ...draft,
                key: saved.id,
                quantity_billed: saved.quantity_billed,
                unit_price_billed: saved.unit_price_billed,
                po_unit_price: saved.po_unit_price ?? saved.unit_price_billed,
                quantity_already_invoiced: String(alreadyExcludingThis),
              };
            })
            .filter(
              (line) =>
                detail.lines?.some((saved) => saved.purchase_order_item_id === line.po_item_id) ||
                Number(line.quantity_billed) > 0
            );

          return {
            ...current,
            selected_grn_ids: selectedIds,
            lines: mergedLines,
          };
        }

        if (isEditing && current.lines.length > 0) {
          return { ...current, selected_grn_ids: selectedIds };
        }

        return {
          ...current,
          selected_grn_ids: selectedIds,
          lines: draftLines,
        };
      });
    });

    return () => {
      cancelled = true;
    };
  }, [open, readOnly, isEditing, form.purchase_order_id, billableOrders, detail?.lines]);

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
    const quantityError = validateBillDraftLineQuantities(savableLines);
    if (quantityError) {
      setError(quantityError);
      return;
    }

    startTransition(async () => {
      const result = await savePurchaseBill({
        purchase_invoice_id: isEditing ? editBillId : null,
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
      onAfterSave(result.purchaseInvoiceId);
    });
  }, [editBillId, form, isEditing, onAfterSave, selectedPo?.currency_code]);

  const handleApplyPpv = useCallback(() => {
    if (!detail?.id) return;
    setError(null);
    startTransition(async () => {
      const result = await applyPurchasePriceVariance(detail.id);
      if ("error" in result) {
        setError(result.error ?? "Request failed.");
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
      onAfterSave(detail.id);
    });
  }, [detail?.id, onAfterSave]);

  const canVoidBill =
    detail != null &&
    !detail.is_paid &&
    (detail.document_status == null || detail.document_status === "ACTIVE");

  const handleVoidBill = useCallback(() => {
    if (!detail?.id) return;
    setError(null);
    startTransition(async () => {
      const result = await voidPurchaseBill(detail.id);
      if ("error" in result) {
        setError(result.error ?? "Unable to void bill.");
        return;
      }
      toast.success("Supplier bill voided");
      setVoidDialogOpen(false);
      setPostingSummary({
        steps: result.steps ?? [],
        overall: result.overall === "failure" ? "failure" : "success",
      });
      onAfterSave(detail.id);
    });
  }, [detail?.id, onAfterSave]);

  const headerActions = readOnly ? (
    <div className="flex items-center gap-2">
      {detail ? (
        <DocumentPrintButton
          moduleKey="PURCHASE_INVOICE"
          documentId={detail.id}
          documentLocationId={detail.billing_location_id}
        />
      ) : null}
      {detail && !detail.is_paid && onOpenEdit ? (
        <Button size="sm" variant="outline" onClick={() => onOpenEdit(detail.id)}>
          Edit
        </Button>
      ) : null}
      {canVoidBill ? (
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => setVoidDialogOpen(true)}>
          Void
        </Button>
      ) : null}
      {detail?.match_status === "PPV_HOLD" ? (
        <Button size="sm" disabled={isPending} onClick={handleApplyPpv}>
          {isPending ? "Applying…" : "Apply PPV"}
        </Button>
      ) : (
        <Button size="sm" onClick={handleRequestClose}>
          Close
        </Button>
      )}
    </div>
  ) : postingSummary ? (
    <Button size="sm" onClick={handleRequestClose}>
      Close
    </Button>
  ) : (
    <Button size="sm" disabled={isPending} onClick={handleSave}>
      {isPending ? "Saving…" : isEditing ? "Save changes" : "Save bill"}
    </Button>
  );

  return (
    <>
    <RightDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) handleRequestClose();
      }}
      onRequestClose={handleRequestClose}
      title={
        detail?.system_voucher_number ??
        peekBill?.system_voucher_number ??
        (isEditing ? "Edit supplier bill" : "New supplier bill")
      }
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
          <div className="space-y-4">
            <BillPeekView bill={detail} matchingTolerancePct={matchingTolerancePct} />
            <BillAdvanceApplicationPanel
              purchaseInvoiceId={detail.id}
              supplierId={detail.supplier_id}
              invoiceLiability={detail.total_liability_amount}
              onApplied={reloadDetail}
            />
            <BillPaymentPanel
              purchaseInvoiceId={detail.id}
              invoiceLiability={detail.total_liability_amount}
              isPaid={detail.is_paid}
              onPaid={reloadDetail}
            />
          </div>
        ) : null
      ) : isCreating || isEditing ? (
        postingSummary ? null : (
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
        )
      ) : null}
    </RightDrawer>
    <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void supplier bill?</AlertDialogTitle>
          <AlertDialogDescription>
            This reverses invoiced quantities on the purchase order and cancels the bill. Paid bills
            cannot be voided.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={handleVoidBill}>
            {isPending ? "Voiding…" : "Void bill"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    {discardDialog}
    </>
  );
}
