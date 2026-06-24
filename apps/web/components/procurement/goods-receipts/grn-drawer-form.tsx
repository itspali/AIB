"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  loadGoodsReceiptDetail,
  loadGrnVariantQcPolicies,
  loadImportLogisticsSettingsForGrn,
  loadReceivableImportShipments,
  postGoodsReceipt,
} from "@/app/procurement/goods-receipts/actions";
import {
  filterSavableGrnLandedCharges,
  GrnLandedChargesPanel,
  type GrnLandedChargeDraft,
} from "@/components/procurement/goods-receipts/grn-landed-charges-panel";
import {
  createEmptyGrnLine,
  filterSavableGrnLines,
  grnFormHasInvalidExceptions,
  GrnLineEntryTable,
  mapReceivablePoLineToGrnDraft,
  type GrnDraftLine,
} from "@/components/procurement/goods-receipts/grn-line-entry-table";
import { GrnGitLinkPanel } from "@/components/procurement/goods-receipts/grn-git-link-panel";
import { GrnImportTaxPeekPanel } from "@/components/procurement/goods-receipts/grn-import-tax-peek-panel";
import { DocumentPrintButton } from "@/components/documents/document-print-button";
import { GrnQcReleasePanel } from "@/components/procurement/goods-receipts/grn-qc-release-panel";
import {
  DocumentLinePeekItemCell,
  DocumentLinePeekTable,
  DocumentLinePeekValueCell,
} from "@/components/documents/document-line-peek-table";
import { DocumentPostingSummaryPanel } from "@/components/documents/document-posting-summary-panel";
import { DocumentPeekActivityShell } from "@/components/activity/document-peek-activity-shell";
import { PoPromoEntitlementsPanel } from "@/components/procurement/purchase-orders/po-promo-entitlements-panel";
import { RightDrawer } from "@/components/ui/right-drawer";
import { UserFacingErrorMessage } from "@/components/ui/user-facing-error-message";
import { grnLineHasImportTax } from "@/lib/procurement/goods-receipts/grn-import-tax";
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
import type { PostingStepResult } from "@/lib/documents/posting-types";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import { isMutationSurface, type DrawerSurface } from "@/lib/layout/module-drawer-url";
import type { ImportLogisticsSettings } from "@/lib/procurement/import-logistics-settings";
import {
  grnReceiptStageLabel,
  resolveGrnReceiptContext,
  type GrnReceiptStage,
} from "@/lib/procurement/import-logistics/receipt-context";
import type { ReceivableImportShipmentOption } from "@/lib/procurement/shipments/queries";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import type { ReceivablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";
import type { ProcurementLocationOption } from "@/lib/procurement/shared/types";
import type { LandedCostAllocationMethod, ProcurementSettings } from "@/lib/procurement/settings";
import {
  resolveDefaultRouteToQc,
  type QcPolicyContext,
  type VariantQcPolicyHint,
} from "@/lib/procurement/qc-receipt-policy";
import {
  buildGrnPeekLineColumns,
  buildGrnPeekLineMinTableWidth,
  grnPeekLineCellValue,
} from "@/lib/procurement/goods-receipts/grn-qc-release";
import { ensureTrailingEmptyLine } from "@/lib/documents/line-entry";
import { useDocumentLineTableFillHeight } from "@/lib/documents/use-document-line-table-fill-height";
import { cn } from "@/lib/utils";

type CreateFormState = {
  destination_location_id: string;
  purchase_order_id: string | null;
  shipment_id: string | null;
  receipt_stage: GrnReceiptStage;
  is_po_fulfilling: boolean;
  staging_location_id: string | null;
  bill_of_entry_number: string;
  bill_of_entry_date: string;
  port_code: string;
  exchange_rate: string;
  assessable_value: string;
  customs_duty_amount: string;
  import_igst_amount: string;
  lines: GrnDraftLine[];
  landed_charges: GrnLandedChargeDraft[];
  git_voucher_id: string | null;
};

type Props = {
  open: boolean;
  surface: DrawerSurface;
  locations: ProcurementLocationOption[];
  receivableOrders: ReceivablePurchaseOrderOption[];
  peekReceipt: GoodsReceiptRow | null;
  prefillPurchaseOrderId?: string | null;
  defaultLandedCostAllocationMethod?: LandedCostAllocationMethod;
  procurementSettings: Pick<
    ProcurementSettings,
    "is_qc_required_before_stocking" | "allow_qc_line_override"
  >;
  importLogisticsSettings?: ImportLogisticsSettings;
  onClose: () => void;
  onAfterSave: (goodsReceiptId: string) => void;
  onReceiptUpdated?: () => void;
};

function defaultCreateForm(
  locations: ProcurementLocationOption[],
  prefillPoId?: string | null,
  receivableOrders: ReceivablePurchaseOrderOption[] = [],
  entryLineKey?: string
): CreateFormState {
  const selectedPo = prefillPoId
    ? receivableOrders.find((order) => order.id === prefillPoId)
    : null;

  if (selectedPo) {
    return {
      destination_location_id: selectedPo.destination_location_id,
      purchase_order_id: selectedPo.id,
      shipment_id: null,
      receipt_stage: "FINAL",
      is_po_fulfilling: true,
      staging_location_id: selectedPo.receipt_location_id ?? null,
      bill_of_entry_number: "",
      bill_of_entry_date: "",
      port_code: "",
      exchange_rate: "1",
      assessable_value: "",
      customs_duty_amount: "",
      import_igst_amount: "",
      lines: selectedPo.lines.map((line) => mapReceivablePoLineToGrnDraft(line)),
      landed_charges: [],
      git_voucher_id: null,
    };
  }

  return {
    destination_location_id: locations[0]?.id ?? "",
    purchase_order_id: null,
    shipment_id: null,
    receipt_stage: "FINAL",
    is_po_fulfilling: true,
    staging_location_id: null,
    bill_of_entry_number: "",
    bill_of_entry_date: "",
    port_code: "",
    exchange_rate: "1",
    assessable_value: "",
    customs_duty_amount: "",
    import_igst_amount: "",
    lines: ensureTrailingEmptyLine(
      [createEmptyGrnLine(entryLineKey)],
      () => false,
      createEmptyGrnLine
    ),
    landed_charges: [],
    git_voucher_id: null,
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
  defaultLandedCostAllocationMethod = "BY_VALUE",
  procurementSettings,
  importLogisticsSettings: importLogisticsSettingsProp,
  onClose,
  onAfterSave,
  onReceiptUpdated,
}: Props) {
  const readOnly = surface === "peek";
  const isMutating = isMutationSurface(surface);
  const lineTableFillHeight = useDocumentLineTableFillHeight(isMutating);
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating,
  });

  const prefillSignature = prefillPurchaseOrderId ?? "";
  const entryLineKey = useId();

  const [form, setForm] = useState<CreateFormState>(() =>
    defaultCreateForm(locations, prefillPurchaseOrderId, receivableOrders, entryLineKey)
  );
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<UserFacingErrorAction | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState<GoodsReceiptRow | null>(peekReceipt);
  const [detailLoading, setDetailLoading] = useState(false);
  const [postSuccessSummary, setPostSuccessSummary] = useState<{
    steps: PostingStepResult[];
    goodsReceiptId: string;
  } | null>(null);
  const submitRef = useRef<() => void>(() => {});

  const qcContext = useMemo<QcPolicyContext>(
    () => ({
      qcModuleEnabled: procurementSettings.is_qc_required_before_stocking,
      allowLineOverride: procurementSettings.allow_qc_line_override,
      orgDefaultRouteToQc: procurementSettings.is_qc_required_before_stocking,
    }),
    [procurementSettings]
  );

  const [policyHints, setPolicyHints] = useState<Record<string, VariantQcPolicyHint>>({});
  const [importLogisticsSettings, setImportLogisticsSettings] = useState<ImportLogisticsSettings | null>(
    importLogisticsSettingsProp ?? null
  );
  const [shipments, setShipments] = useState<ReceivableImportShipmentOption[]>([]);

  useEffect(() => {
    if (!open || importLogisticsSettingsProp) return;
    void loadImportLogisticsSettingsForGrn().then(setImportLogisticsSettings);
  }, [open, importLogisticsSettingsProp]);

  useEffect(() => {
    if (!open || !form.purchase_order_id) {
      setShipments([]);
      return;
    }
    void loadReceivableImportShipments(form.purchase_order_id).then(setShipments);
  }, [open, form.purchase_order_id]);

  const applyPolicyHintsToLines = useCallback(
    (lines: GrnDraftLine[], hints: Record<string, VariantQcPolicyHint>) =>
      lines.map((line) => {
        if (!line.variant_id) return line;
        const hint = hints[line.variant_id];
        if (!hint) return line;
        return {
          ...line,
          item_id: hint.item_id,
          route_to_qc: resolveDefaultRouteToQc(qcContext, hint),
        };
      }),
    [qcContext]
  );

  const refreshPolicyHints = useCallback(
    async (lines: GrnDraftLine[]) => {
      const variantIds = lines.map((line) => line.variant_id).filter(Boolean);
      if (!variantIds.length) {
        setPolicyHints({});
        return;
      }
      const hints = await loadGrnVariantQcPolicies(variantIds);
      setPolicyHints(hints);
      setForm((current) => ({
        ...current,
        lines: applyPolicyHintsToLines(current.lines, hints),
      }));
    },
    [applyPolicyHintsToLines]
  );

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
    setError(null);
    setErrorAction(null);
    setIsDirty(false);
    setPostSuccessSummary(null);

    if (surface === "create") {
      setForm(
        defaultCreateForm(locations, prefillPurchaseOrderId, receivableOrders, entryLineKey)
      );
      setDetail(null);
    }
  }, [
    entryLineKey,
    open,
    surface,
    locations,
    prefillSignature,
    prefillPurchaseOrderId,
    receivableOrders,
  ]);

  const reloadDetail = useCallback(async (goodsReceiptId?: string) => {
    const id = goodsReceiptId ?? detail?.id ?? peekReceipt?.id;
    if (!id) return;

    setDetailLoading(true);
    const result = await loadGoodsReceiptDetail(id);
    setDetailLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setDetail(result.goodsReceipt);
  }, [detail?.id, peekReceipt?.id]);

  const handleQcReleased = useCallback(async () => {
    const id = detail?.id ?? peekReceipt?.id;
    await reloadDetail(id);
    onReceiptUpdated?.();
  }, [detail?.id, onReceiptUpdated, peekReceipt?.id, reloadDetail]);

  useEffect(() => {
    if (!open || surface !== "peek" || !peekReceipt?.id) return;

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
  }, [open, surface, peekReceipt?.id]);

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

  const handlePoChange = (purchaseOrderId: string) => {
    if (purchaseOrderId === "none") {
      patchForm({
        purchase_order_id: null,
        git_voucher_id: null,
        lines: ensureTrailingEmptyLine(
          [createEmptyGrnLine(entryLineKey)],
          () => false,
          createEmptyGrnLine
        ),
      });
      setPolicyHints({});
      return;
    }

    const selectedPo = receivableOrders.find((order) => order.id === purchaseOrderId);
    if (!selectedPo) return;

    const nextLines = selectedPo.lines.map((line) =>
      mapReceivablePoLineToGrnDraft({
        ...line,
        item_id: line.item_id,
      })
    );

    patchForm({
      destination_location_id: selectedPo.destination_location_id,
      purchase_order_id: selectedPo.id,
      shipment_id: null,
      git_voucher_id: null,
      lines: nextLines,
    });
    void refreshPolicyHints(nextLines);
  };

  const hasInvalidExceptions = useMemo(
    () => grnFormHasInvalidExceptions(form.lines),
    [form.lines]
  );

  const selectedReceivablePo = form.purchase_order_id
    ? receivableOrders.find((order) => order.id === form.purchase_order_id)
    : null;
  const selectedShipment = form.shipment_id
    ? shipments.find((shipment) => shipment.id === form.shipment_id) ?? null
    : null;
  const isImportGoodsPo = selectedReceivablePo?.tax_supply_nature === "IMPORT_GOODS";
  const logisticsSettings = importLogisticsSettingsProp ?? importLogisticsSettings;
  const receiptContext = useMemo(() => {
    if (!logisticsSettings) return null;
    return resolveGrnReceiptContext(
      logisticsSettings,
      selectedReceivablePo
        ? {
            id: selectedReceivablePo.id,
            tax_supply_nature: selectedReceivablePo.tax_supply_nature,
            destination_location_id: selectedReceivablePo.destination_location_id,
            receipt_location_id: selectedReceivablePo.receipt_location_id,
            ultimate_destination_location_id: selectedReceivablePo.ultimate_destination_location_id,
            po_fulfillment_stage_override: selectedReceivablePo.po_fulfillment_stage_override,
          }
        : null,
      selectedShipment,
      {
        receiptStage: form.receipt_stage,
        hasGitVoucher: Boolean(form.git_voucher_id),
      }
    );
  }, [
    form.git_voucher_id,
    form.receipt_stage,
    logisticsSettings,
    selectedReceivablePo,
    selectedShipment,
  ]);

  useEffect(() => {
    if (!receiptContext || !isMutating) return;
    setForm((current) => {
      const nextDestination =
        receiptContext.defaultDestinationLocationId ?? current.destination_location_id;
      if (
        current.receipt_stage === receiptContext.receiptStage &&
        current.is_po_fulfilling === receiptContext.isPoFulfilling &&
        current.destination_location_id === nextDestination &&
        current.staging_location_id === receiptContext.stagingLocationId
      ) {
        return current;
      }
      return {
        ...current,
        receipt_stage: receiptContext.receiptStage,
        is_po_fulfilling: receiptContext.isPoFulfilling,
        destination_location_id: nextDestination,
        staging_location_id: receiptContext.stagingLocationId,
      };
    });
  }, [isMutating, receiptContext]);

  const handleSubmit = useCallback(() => {
    if (hasInvalidExceptions) {
      setError("Fix exception quantities before posting this receipt.");
      return;
    }
    setError(null);
    setErrorAction(null);
    startTransition(async () => {
      const payload = {
        destination_location_id: form.destination_location_id,
        purchase_order_id: form.purchase_order_id,
        bill_of_entry_number: form.bill_of_entry_number || null,
        bill_of_entry_date: form.bill_of_entry_date || null,
        port_code: form.port_code || null,
        exchange_rate: form.exchange_rate || null,
        assessable_value: form.assessable_value || null,
        customs_duty_amount: form.customs_duty_amount || null,
        import_igst_amount: form.import_igst_amount || null,
        lines: filterSavableGrnLines(form.lines).map((line) => ({
          variant_id: line.variant_id,
          po_item_id: line.po_item_id,
          quantity_received: line.quantity_received,
          quantity_accepted: line.quantity_accepted,
          quantity_rejected: line.quantity_rejected,
          exception_quantity: line.exception_quantity,
          route_to_qc: line.route_to_qc,
          raw_unit_cost: line.raw_unit_cost,
          is_promotional: line.is_promotional ?? Number(line.raw_unit_cost) === 0,
        })),
        landed_charges: filterSavableGrnLandedCharges(form.landed_charges),
        git_voucher_id: form.git_voucher_id,
        shipment_id: form.shipment_id,
        receipt_stage: receiptContext?.receiptStage ?? form.receipt_stage,
        is_po_fulfilling: receiptContext?.isPoFulfilling ?? form.is_po_fulfilling,
        staging_location_id: form.staging_location_id,
        parent_grn_id: null,
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
      setPostSuccessSummary({
        goodsReceiptId: result.goodsReceiptId,
        steps: result.steps ?? [],
      });
      onAfterSave(result.goodsReceiptId);
    });
  }, [form, hasInvalidExceptions, onAfterSave, openQtyByPoItemId, receiptContext]);

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
    postSuccessSummary ? (
      <Button type="button" size="sm" onClick={closeForm}>
        Close
      </Button>
    ) : (
      <Button
        type="button"
        size="sm"
        disabled={isPending || locations.length === 0 || hasInvalidExceptions}
        onClick={handleSubmit}
        title="Post receipt (Ctrl+Enter)"
      >
        {isPending ? "Posting…" : "Post receipt"}
      </Button>
    )
  ) : surface === "peek" && detail ? (
    <DocumentPrintButton
      moduleKey="GOODS_RECEIPT_NOTE"
      documentId={detail.id}
      documentLocationId={detail.destination_location_id}
    />
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
        bodyClassName={isMutating ? "module-drawer-form-body" : undefined}
        scrollable={!(isMutating && lineTableFillHeight)}
        showCloseButton
      >
        <div
          className={cn(
            isMutating && lineTableFillHeight && "flex min-h-0 flex-1 flex-col"
          )}
        >
          {error ? (
            <UserFacingErrorMessage
              message={error}
              action={errorAction ?? undefined}
              className="mb-4 shrink-0"
            />
          ) : null}

          {showLoadingPeek ? (
          <p className="text-sm text-muted-foreground">Loading goods receipt…</p>
        ) : readOnly && detail ? (
          (() => {
            const peekLines = detail.lines ?? [];
            const showLineImportTax = peekLines.some(grnLineHasImportTax);
            const peekColumns = buildGrnPeekLineColumns({
              isQcPending: detail.is_qc_pending,
              qcModuleEnabled: qcContext.qcModuleEnabled,
              showLineImportTax,
            });
            return (
          <DocumentPeekActivityShell
            entityType="GOODS_RECEIPT"
            entityId={detail.id}
            refreshKey={`${detail.id}:${detail.created_at}:${postSuccessSummary?.steps.length ?? 0}`}
          >
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

            <GrnImportTaxPeekPanel receipt={detail} />

            <GrnQcReleasePanel
              goodsReceiptId={detail.id}
              isQcPending={detail.is_qc_pending}
              qcModuleEnabled={qcContext.qcModuleEnabled}
              qcLines={detail.lines ?? []}
              onReleased={handleQcReleased}
            />

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {detail.is_qc_pending ? "Receipt summary" : "Lines"}
              </p>
              {detail.is_qc_pending ? (
                <p className="mb-2 text-xs text-muted-foreground">
                  Quantities and costs recorded at receipt. Use quality inspection above to post
                  stock or record rejects.
                </p>
              ) : qcContext.qcModuleEnabled ? (
                <p className="mb-2 text-xs text-muted-foreground">
                  Posted to stock and QC reject columns reflect the inspection outcome. Dock exc.
                  covers damage or shortages recorded at receipt.
                </p>
              ) : null}
              <DocumentLinePeekTable
                lines={peekLines}
                getRowKey={(line) => line.id}
                minTableWidth={buildGrnPeekLineMinTableWidth(peekColumns)}
                columns={peekColumns}
                renderCell={(column, line) => {
                  if (column.id === "item") {
                    return (
                      <DocumentLinePeekItemCell
                        itemName={line.item_name}
                        variantSku={line.variant_sku}
                      />
                    );
                  }
                  return (
                    <DocumentLinePeekValueCell
                      value={grnPeekLineCellValue(column.id, line, detail.is_qc_pending)}
                    />
                  );
                }}
              />
            </div>
          </div>
          </DocumentPeekActivityShell>
            );
          })()
        ) : isMutating ? (
          postSuccessSummary ? (
            <DocumentPostingSummaryPanel
              steps={postSuccessSummary.steps}
              overall="success"
            />
          ) : (
          <div
            className={cn(
              "flex flex-col gap-5",
              lineTableFillHeight && "h-full min-h-0 flex-1 overflow-hidden",
              !lineTableFillHeight && "pb-20"
            )}
          >
            <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2">
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
                      lines: ensureTrailingEmptyLine(
                        [createEmptyGrnLine(entryLineKey)],
                        () => false,
                        createEmptyGrnLine
                      ),
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

            {form.purchase_order_id ? (
              <PoPromoEntitlementsPanel
                purchaseOrderId={form.purchase_order_id}
                variant="banner"
                className="shrink-0"
              />
            ) : null}

            {form.purchase_order_id && isImportGoodsPo && shipments.length > 0 ? (
              <div className="space-y-2 shrink-0">
                <Label>Import shipment</Label>
                <Select
                  value={form.shipment_id ?? "none"}
                  onValueChange={(value) => {
                    if (value === "none") {
                      patchForm({ shipment_id: null });
                      return;
                    }
                    const shipment = shipments.find((row) => row.id === value);
                    patchForm({
                      shipment_id: value,
                      bill_of_entry_number: shipment?.bill_of_entry_number ?? "",
                      bill_of_entry_date: shipment?.bill_of_entry_date ?? "",
                      port_code: shipment?.port_code ?? "",
                      exchange_rate: shipment?.exchange_rate ?? form.exchange_rate,
                      assessable_value: shipment?.assessable_value ?? "",
                      customs_duty_amount: shipment?.customs_duty_amount ?? "",
                      import_igst_amount: shipment?.import_igst_amount ?? "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select shipment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No shipment</SelectItem>
                    {shipments.map((shipment) => (
                      <SelectItem key={shipment.id} value={shipment.id}>
                        {shipment.shipment_number} · {shipment.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {isImportGoodsPo && receiptContext?.showStageSelector ? (
              <div className="space-y-2 shrink-0">
                <Label>Receipt stage</Label>
                <Select
                  value={form.receipt_stage}
                  onValueChange={(value) =>
                    patchForm({
                      receipt_stage: value as GrnReceiptStage,
                      git_voucher_id: value === "GIT_CLEARANCE" ? form.git_voucher_id : null,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {receiptContext.allowedStages.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {grnReceiptStageLabel(stage)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  PO fulfillment: {receiptContext.isPoFulfilling ? "yes" : "inventory only"}
                </p>
              </div>
            ) : null}

            {form.purchase_order_id && isImportGoodsPo ? (
              <GrnGitLinkPanel
                purchaseOrderId={form.purchase_order_id}
                shipmentId={form.shipment_id}
                value={form.git_voucher_id}
                visible={receiptContext?.showGitLink ?? false}
                onChange={(git_voucher_id) =>
                  patchForm({
                    git_voucher_id,
                    receipt_stage: git_voucher_id ? "GIT_CLEARANCE" : form.receipt_stage,
                  })
                }
                className="shrink-0"
              />
            ) : null}

            {isImportGoodsPo ? (
              <div className="surface-inset grid shrink-0 grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                <p className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Import / Bill of entry
                  {receiptContext?.requireBoe ? " (required)" : " (optional for this stage)"}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="grn-boe-number">Bill of entry #</Label>
                  <Input
                    id="grn-boe-number"
                    value={form.bill_of_entry_number}
                    readOnly={Boolean(selectedShipment?.bill_of_entry_number) && !receiptContext?.boeEditable}
                    onChange={(event) => patchForm({ bill_of_entry_number: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grn-boe-date">BoE date</Label>
                  <Input
                    id="grn-boe-date"
                    type="date"
                    value={form.bill_of_entry_date}
                    onChange={(event) => patchForm({ bill_of_entry_date: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grn-port-code">Port code</Label>
                  <Input
                    id="grn-port-code"
                    value={form.port_code}
                    onChange={(event) => patchForm({ port_code: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grn-exchange-rate">Exchange rate</Label>
                  <Input
                    id="grn-exchange-rate"
                    inputMode="decimal"
                    value={form.exchange_rate}
                    onChange={(event) => patchForm({ exchange_rate: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grn-assessable-value">Assessable value</Label>
                  <Input
                    id="grn-assessable-value"
                    inputMode="decimal"
                    value={form.assessable_value}
                    onChange={(event) => patchForm({ assessable_value: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grn-customs-duty">Customs duty</Label>
                  <Input
                    id="grn-customs-duty"
                    inputMode="decimal"
                    value={form.customs_duty_amount}
                    onChange={(event) => patchForm({ customs_duty_amount: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grn-import-igst">Import IGST</Label>
                  <Input
                    id="grn-import-igst"
                    inputMode="decimal"
                    value={form.import_igst_amount}
                    onChange={(event) => patchForm({ import_igst_amount: event.target.value })}
                  />
                </div>
              </div>
            ) : null}

            <GrnLandedChargesPanel
              charges={form.landed_charges}
              defaultAllocationMethod={defaultLandedCostAllocationMethod}
              disabled={isPending}
              className="shrink-0"
              onChange={(landed_charges) => patchForm({ landed_charges })}
            />

            <div
              className={cn(
                "min-h-0 min-w-0",
                lineTableFillHeight && "flex flex-1 flex-col"
              )}
            >
              <GrnLineEntryTable
                fillHeight={lineTableFillHeight}
                lines={form.lines}
                poLocked={poLocked}
                disabled={isPending}
                qcContext={qcContext}
                policyHints={policyHints}
                onChange={(linesOrUpdater) => {
                  setForm((current) => {
                    const nextLines =
                      typeof linesOrUpdater === "function"
                        ? linesOrUpdater(current.lines)
                        : linesOrUpdater;
                    return { ...current, lines: nextLines };
                  });
                  setIsDirty(true);
                }}
              />
            </div>
          </div>
          )
        ) : null}
        </div>
      </RightDrawer>
      {discardDialog}
    </>
  );
}
