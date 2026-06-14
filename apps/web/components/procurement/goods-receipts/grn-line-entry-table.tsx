"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { StockVariantSkuField } from "@/components/inventory/stock/stock-variant-sku-field";
import {
  DocumentLineCompactInput,
  DOCUMENT_LINE_ITEM_CELL_INPUT_CLASS,
  DocumentLineReadOnlyItemCell,
} from "@/components/documents/document-line-entry-cells";
import {
  DocumentLineEntryGrid,
  DocumentLineEntrySection,
  type DocumentLineColumn,
} from "@/components/documents/document-line-entry-grid";
import {
  ensureTrailingEmptyLine,
  isDocumentLineItemSelected,
} from "@/lib/documents/line-entry";
import { prefetchBrowseVariants } from "@/lib/inventory/stock/variant-suggestion-cache";
import {
  GRN_REJECT_DISPOSITIONS,
  grnRejectDispositionLabel,
  type GrnRejectDisposition,
} from "@/lib/procurement/goods-receipts/grn-reject-dispositions";
import {
  defaultGrnExceptionForReceived,
  isGrnExceptionInvalid,
  syncGrnQuantitiesOnExceptionChange,
  syncGrnQuantitiesOnReceivedChange,
} from "@/lib/procurement/goods-receipts/grn-line-validation";
import {
  grnStockColumnLabel,
  resolveDefaultRouteToQc,
  type QcPolicyContext,
  type VariantQcPolicyHint,
} from "@/lib/procurement/qc-receipt-policy";
import { resolveGrnLineQcRouteUi } from "@/lib/procurement/goods-receipts/grn-line-qc-route";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export {
  GRN_REJECT_DISPOSITIONS,
  grnRejectDispositionLabel,
  type GrnRejectDisposition,
} from "@/lib/procurement/goods-receipts/grn-reject-dispositions";

export type GrnDraftLine = {
  key: string;
  sku: string;
  variant_id: string;
  item_id: string;
  item_name: string;
  variant_sku: string;
  po_item_id: string | null;
  quantity_received: string;
  exception_quantity: string;
  quantity_accepted: string;
  quantity_rejected: string;
  reject_disposition: "RTV" | "SCRAP" | "DAMAGE" | "SHRINK";
  route_to_qc: boolean;
  raw_unit_cost: string;
  open_quantity: string | null;
  is_promotional?: boolean;
  skuError: string | null;
};

export function mapReceivablePoLineToGrnDraft(
  line: {
    id: string;
    variant_id: string;
    variant_sku: string;
    item_name: string;
    open_quantity: string;
    unit_price_contractual: string;
    is_promotional?: boolean;
    item_id?: string;
  },
  options?: {
    routeToQc?: boolean;
  }
): GrnDraftLine {
  const unitPrice = line.unit_price_contractual;
  const received = line.open_quantity;
  const quantities = defaultGrnExceptionForReceived(received);
  return {
    key: line.id,
    sku: line.variant_sku,
    variant_id: line.variant_id,
    item_id: line.item_id ?? "",
    item_name: line.item_name,
    variant_sku: line.variant_sku,
    po_item_id: line.id,
    quantity_received: received,
    exception_quantity: quantities.exception_quantity,
    quantity_accepted: quantities.quantity_accepted,
    quantity_rejected: quantities.quantity_rejected,
    reject_disposition: "SCRAP",
    route_to_qc: options?.routeToQc ?? false,
    raw_unit_cost: unitPrice,
    open_quantity: line.open_quantity,
    is_promotional: line.is_promotional ?? Number(unitPrice) === 0,
    skuError: null,
  };
}

type Props = {
  lines: GrnDraftLine[];
  poLocked: boolean;
  disabled?: boolean;
  showSectionTitle?: boolean;
  fillHeight?: boolean;
  qcContext: QcPolicyContext;
  policyHints: Record<string, VariantQcPolicyHint>;
  onChange: (lines: GrnDraftLine[] | ((current: GrnDraftLine[]) => GrnDraftLine[])) => void;
};

export function createEmptyGrnLine(key?: string): GrnDraftLine {
  return {
    key: key ?? crypto.randomUUID(),
    sku: "",
    variant_id: "",
    item_id: "",
    item_name: "",
    variant_sku: "",
    po_item_id: null,
    quantity_received: "",
    exception_quantity: "0",
    quantity_accepted: "",
    quantity_rejected: "0",
    reject_disposition: "SCRAP",
    route_to_qc: false,
    raw_unit_cost: "0",
    open_quantity: null,
    skuError: null,
  };
}

function isGrnLineComplete(line: GrnDraftLine): boolean {
  return Boolean(line.variant_id) && Number(line.quantity_received) > 0;
}

function useGrnLineEntryActions(
  lines: GrnDraftLine[],
  poLocked: boolean,
  qcContext: QcPolicyContext,
  policyHints: Record<string, VariantQcPolicyHint>,
  onChange: (lines: GrnDraftLine[] | ((current: GrnDraftLine[]) => GrnDraftLine[])) => void
) {
  const itemRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

  const patchLine = useCallback(
    (key: string, patch: Partial<GrnDraftLine>) => {
      onChange((current) => {
        const next = current.map((line) => (line.key === key ? { ...line, ...patch } : line));
        if (!poLocked) {
          return ensureTrailingEmptyLine(next, isGrnLineComplete, createEmptyGrnLine);
        }
        return next;
      });
    },
    [onChange, poLocked]
  );

  const removeLine = useCallback(
    (key: string) => {
      if (poLocked) return;
      onChange((current) => {
        if (current.length <= 1) return current;
        const next = current.filter((line) => line.key !== key);
        return ensureTrailingEmptyLine(next, isGrnLineComplete, createEmptyGrnLine);
      });
    },
    [onChange, poLocked]
  );

  const applyVariantPolicy = useCallback(
    (line: GrnDraftLine, variantId: string, itemId: string) => {
      const hint = policyHints[variantId];
      const routeToQc = hint
        ? resolveDefaultRouteToQc(qcContext, hint)
        : qcContext.orgDefaultRouteToQc;
      return {
        variant_id: variantId,
        item_id: itemId || hint?.item_id || line.item_id,
        route_to_qc: routeToQc,
      };
    },
    [policyHints, qcContext]
  );

  const bindItemChange = useCallback(
    (lineKey: string) =>
      (patch: Partial<GrnDraftLine> & { unit_cost?: string; item_id?: string }) => {
        onChange((current) => {
          const next = current.map((line) => {
            if (line.key !== lineKey) return line;
            const merged = {
              ...line,
              ...patch,
              raw_unit_cost: patch.unit_cost ?? line.raw_unit_cost,
              item_id: patch.item_id ?? line.item_id,
            };
            if (patch.variant_id && patch.variant_id !== line.variant_id) {
              Object.assign(merged, applyVariantPolicy(line, patch.variant_id, merged.item_id));
            }
            return merged;
          });
          if (!poLocked) {
            return ensureTrailingEmptyLine(next, isDocumentLineItemSelected, createEmptyGrnLine);
          }
          return next;
        });
      },
    [applyVariantPolicy, onChange, poLocked]
  );

  return { itemRefs, patchLine, removeLine, bindItemChange };
}

export function GrnLineEntryTable({
  lines,
  poLocked,
  disabled = false,
  showSectionTitle = true,
  fillHeight = false,
  qcContext,
  policyHints,
  onChange,
}: Props) {
  const actions = useGrnLineEntryActions(lines, poLocked, qcContext, policyHints, onChange);
  const stockLabel = grnStockColumnLabel(qcContext.qcModuleEnabled);

  useEffect(() => {
    if (!poLocked) prefetchBrowseVariants();
  }, [poLocked]);

  const columns = useMemo<DocumentLineColumn[]>(
    () => [
      {
        id: "item",
        label: "Item",
        align: "left",
        widthClass: "min-w-[12rem] w-auto sm:min-w-[16rem]",
        editable: !poLocked,
      },
      {
        id: "quantity_received",
        label: "Received",
        align: "right",
        widthClass: "w-[4.5rem]",
        editable: true,
      },
      {
        id: "exception_quantity",
        label: "Exceptions",
        align: "right",
        widthClass: "w-[4.5rem]",
        editable: true,
      },
      {
        id: "quantity_accepted",
        label: stockLabel,
        align: "right",
        widthClass: "w-[5rem]",
        editable: false,
      },
      {
        id: "raw_unit_cost",
        label: "Unit cost",
        align: "right",
        widthClass: "w-[5rem]",
        editable: true,
      },
    ],
    [poLocked, stockLabel]
  );

  return (
    <DocumentLineEntrySection
      title="Lines"
      fillHeight={fillHeight}
      showSectionTitle={showSectionTitle}
    >
      <p className="-mt-1 text-xs text-muted-foreground">
        Enter received quantity and any dock exceptions. {stockLabel} is calculated automatically.
        {qcContext.qcModuleEnabled
          ? qcContext.allowLineOverride
            ? " Use the QC row under each item to override catalog or organization routing."
            : " QC routing follows item, category, and organization policy — no per-line toggle when overrides are disabled."
          : null}
      </p>
      <DocumentLineEntryGrid
        lines={lines}
        columns={columns}
        minTableWidth="min-w-[44rem]"
        fillHeight={fillHeight}
        disabled={disabled}
        showRemoveColumn={!poLocked}
        canRemoveLine={(_, __, allLines) => !poLocked && allLines.length > 1}
        onRemoveLine={actions.removeLine}
        renderCell={(column, line) => {
          if (column.id === "item") {
            if (poLocked) {
              return (
                <div className="space-y-2 px-2 py-2">
                  <DocumentLineReadOnlyItemCell
                    itemName={line.item_name}
                    variantSku={line.variant_sku}
                    hint={line.open_quantity ? `Open: ${line.open_quantity}` : null}
                  />
                  {qcContext.qcModuleEnabled && line.variant_id ? (
                    <GrnLineQcSubRow
                      line={line}
                      disabled={disabled}
                      qcContext={qcContext}
                      policyHint={policyHints[line.variant_id] ?? null}
                      onRouteChange={(routeToQc) =>
                        actions.patchLine(line.key, { route_to_qc: routeToQc })
                      }
                    />
                  ) : null}
                </div>
              );
            }

            return (
              <div className="min-w-0 px-2 py-2 text-sm">
                <StockVariantSkuField
                  compact
                  displayMode="item"
                  disabled={disabled}
                  inputClassName={DOCUMENT_LINE_ITEM_CELL_INPUT_CLASS}
                  inputRef={(node) => {
                    actions.itemRefs.current[line.key] = node;
                  }}
                  value={{
                    sku: line.sku,
                    variant_id: line.variant_id,
                    item_name: line.item_name,
                    variant_sku: line.variant_sku,
                    unit_cost: line.raw_unit_cost || "0",
                    skuError: line.skuError,
                  }}
                  onChange={actions.bindItemChange(line.key)}
                />
                {qcContext.qcModuleEnabled && line.variant_id ? (
                  <GrnLineQcSubRow
                    line={line}
                    disabled={disabled}
                    qcContext={qcContext}
                    policyHint={policyHints[line.variant_id] ?? null}
                    onRouteChange={(routeToQc) =>
                      actions.patchLine(line.key, { route_to_qc: routeToQc })
                    }
                  />
                ) : null}
              </div>
            );
          }

          if (column.id === "quantity_received") {
            return (
              <DocumentLineCompactInput
                align="right"
                value={line.quantity_received}
                disabled={disabled}
                inputMode="decimal"
                aria-label="Quantity received"
                onChange={(event) =>
                  actions.patchLine(
                    line.key,
                    syncGrnQuantitiesOnReceivedChange(line, event.target.value)
                  )
                }
              />
            );
          }

          if (column.id === "exception_quantity") {
            const invalid = isGrnExceptionInvalid(line.quantity_received, line.exception_quantity);
            const hasException = Number(line.exception_quantity) > 0;
            return (
              <div className="space-y-1 px-1 py-1">
                <DocumentLineCompactInput
                  align="right"
                  value={line.exception_quantity}
                  disabled={disabled}
                  inputMode="decimal"
                  aria-label="Exception quantity"
                  className={cn(invalid && "border-destructive focus-visible:ring-destructive/30")}
                  onChange={(event) =>
                    actions.patchLine(
                      line.key,
                      syncGrnQuantitiesOnExceptionChange(line.quantity_received, event.target.value)
                    )
                  }
                />
                {hasException ? (
                  <Select
                    value={line.reject_disposition}
                    disabled={disabled}
                    onValueChange={(value) =>
                      actions.patchLine(line.key, {
                        reject_disposition: value as GrnRejectDisposition,
                      })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Disposition" />
                    </SelectTrigger>
                    <SelectContent>
                      {GRN_REJECT_DISPOSITIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {grnRejectDispositionLabel(d)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            );
          }

          if (column.id === "quantity_accepted") {
            return (
              <DocumentLineCompactInput
                align="right"
                value={line.quantity_accepted}
                disabled
                readOnly
                tabIndex={-1}
                aria-label={stockLabel}
                className="bg-muted/40 text-muted-foreground"
              />
            );
          }

          if (column.id === "raw_unit_cost") {
            return (
              <DocumentLineCompactInput
                align="right"
                value={line.raw_unit_cost}
                disabled={disabled}
                inputMode="decimal"
                aria-label="Unit cost"
                onChange={(event) =>
                  actions.patchLine(line.key, { raw_unit_cost: event.target.value })
                }
              />
            );
          }

          return null;
        }}
      />
    </DocumentLineEntrySection>
  );
}

function GrnLineQcSubRow({
  line,
  disabled,
  qcContext,
  policyHint,
  onRouteChange,
}: {
  line: GrnDraftLine;
  disabled?: boolean;
  qcContext: QcPolicyContext;
  policyHint: VariantQcPolicyHint | null;
  onRouteChange: (routeToQc: boolean) => void;
}) {
  const hasAcceptedQty = Number(line.quantity_accepted) > 0;
  const ui = resolveGrnLineQcRouteUi(qcContext, policyHint, line.route_to_qc);
  const canToggle = ui.canOverride && !disabled && hasAcceptedQty;

  return (
    <div className="mt-2 rounded-md border border-border/80 bg-muted/20 px-2 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-medium text-foreground">{ui.title}</p>
          <p className="text-[10px] leading-snug text-muted-foreground">{ui.description}</p>
        </div>
        {ui.canOverride ? (
          <Switch
            id={`grn-qc-${line.key}`}
            checked={ui.effectiveRoute}
            disabled={!canToggle}
            aria-label={`Route to QC hold for ${line.variant_sku || "line"}`}
            onCheckedChange={onRouteChange}
          />
        ) : (
          <Badge variant={ui.badgeVariant} className="shrink-0 text-[10px] font-normal">
            {ui.badgeLabel}
          </Badge>
        )}
      </div>
      {!hasAcceptedQty ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Enter a received quantity to apply routing.
        </p>
      ) : null}
    </div>
  );
}

export function filterSavableGrnLines(lines: GrnDraftLine[]): GrnDraftLine[] {
  return lines.filter(isGrnLineComplete);
}

export function grnFormHasInvalidExceptions(lines: GrnDraftLine[]): boolean {
  return lines.some((line) =>
    isGrnExceptionInvalid(line.quantity_received, line.exception_quantity)
  );
}
