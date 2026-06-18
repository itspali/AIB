"use client";

import {
  getItemDetailLineFields,
  getPoLineEntryTableColumns,
  getVisibleHeaderFields,
  getVisibleTotalsFields,
  isPoLineColumnVisible,
  PO_LINE_IMAGE_COLUMN_ID,
  shouldShowPoLineInlineImage,
} from "@/lib/documents/purchase-order-layout";
import { formatDocumentDecimal, resolveColumnDecimalPlaces } from "@/lib/documents/decimal-format";
import { groupItemDetailRows } from "@/lib/documents/item-detail-rows";
import {
  getVisiblePoFormHeaderDetailsFields,
  getVisiblePoFormHeaderNotesField,
  getVisiblePoFormHeaderPrimaryFields,
  resolvePoFormFieldsGridProps,
} from "@/lib/documents/po-form-layout";
import { PO_DRAWER_WIDE_SIDE_RAIL_CLASS } from "@/lib/procurement/purchase-orders/po-drawer-side-rail-layout";
import {
  documentFieldLabelTypographyClassName,
  documentFieldValueTypographyClassName,
  documentTypographyClassName,
  resolveColumnTypography,
} from "@/lib/documents/document-typography-classes";
import { DocumentLineImage } from "@/components/documents/document-line-image";
import {
  PoLineQtyUnitSlot,
  PoLineQtyValueStack,
} from "@/components/procurement/purchase-orders/po-line-qty-unit-slot";
import { PoAddressBlocks } from "@/components/procurement/purchase-orders/po-address-blocks";
import { PREVIEW_PO_ADDRESS_BLOCKS } from "@/lib/procurement/purchase-orders/resolve-po-address-blocks";
import type { DocumentColumnPref, DocumentLayoutTemplate } from "@/lib/documents/types";
import { shouldShowPoUnitUnderQtyColumn } from "@/lib/procurement/purchase-orders/po-line-unit";
import { cn } from "@/lib/utils";

type PreviewMode = "drawer" | "peek";

type Props = {
  layout: DocumentLayoutTemplate;
  previewMode: PreviewMode;
  onPreviewModeChange: (mode: PreviewMode) => void;
};

const PREVIEW_LINE_RAW: Partial<Record<string, string>> = {
  sku: "SKU-001",
  quantity_ordered: "1",
  unit: "EA",
  unit_price: "10",
  mrp: "12",
  line_total: "10",
  discount_pct: "0",
  discount_amount: "0",
  tax_rate_pct: "18",
  line_tax_amount: "1.80",
  cgst_amount: "0.90",
  sgst_amount: "0.90",
  igst_amount: "0.00",
};

const PREVIEW_TOTALS_RAW: Partial<Record<string, string>> = {
  line_count: "1",
  subtotal_ex_tax: "10",
  tax_amount: "1.80",
  shipping_amount: "2.00",
  shipping_tax_amount: "0.36",
  round_off_amount: "0.04",
  additional_charges_amount: "1.00",
  grand_total: "15.20",
};

const PREVIEW_HEADER_SAMPLE: Partial<Record<string, string>> = {
  supplier: "Acme Supplies",
  destination: "Main warehouse",
  tax_supply_nature: "Intrastate",
  currency: "USD",
  voucher_number: "PO-00042",
  payment_terms_days: "30",
};

function previewLineValue(column: DocumentColumnPref): string {
  const raw = PREVIEW_LINE_RAW[column.id];
  if (raw == null) return "…";
  if (column.id === "unit" || column.id === "sku") return raw;
  const formatted = formatDocumentDecimal(raw, resolveColumnDecimalPlaces(column));
  if (column.id === "tax_rate_pct") return `${formatted}%`;
  return formatted;
}

const PREVIEW_SECTION_TITLE_CLASS =
  "shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground";

const DETAILS_PREVIEW_LABEL_CLASS =
  "min-w-0 flex-1 truncate text-sm leading-snug text-muted-foreground";

function resolveCompactDetailsPreviewLabel(field: DocumentColumnPref): string {
  switch (field.id) {
    case "payment_terms_days":
      return "Terms (days)";
    case "expected_delivery_date":
      return "Delivery";
    case "requisition_number":
      return "Requisition";
    case "tax_supply_nature":
      return "Supply type";
    default:
      return field.label;
  }
}

function DetailsFieldPreviewRow({ field }: { field: DocumentColumnPref }) {
  const sample = PREVIEW_HEADER_SAMPLE[field.id];
  return (
    <div className="flex min-h-7 items-center gap-2.5 text-sm">
      <span className={documentFieldLabelTypographyClassName(field, DETAILS_PREVIEW_LABEL_CLASS)}>
        {resolveCompactDetailsPreviewLabel(field)}
      </span>
      <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5">
        {field.id === "tax_supply_nature" ? (
          <>
            <span className={previewValueClass(field, "text-right")}>{sample ?? "…"}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className={documentTypographyClassName(resolveColumnTypography(field, "label"), "text-right text-xs leading-snug text-muted-foreground")}>
              Forward charge
            </span>
          </>
        ) : (
          <span className={previewValueClass(field, "text-right tabular-nums")}>{sample ?? "…"}</span>
        )}
      </div>
    </div>
  );
}

function TotalsPreviewPanel({ fields }: { fields: DocumentColumnPref[] }) {
  if (fields.length === 0) return null;

  return (
    <div className="surface-inset min-w-0 space-y-1 p-3 text-sm">
      {fields.map((field) => (
        <div key={field.id} className="flex min-h-7 items-center gap-2.5">
          <dt className={previewLabelClass(field, "min-w-0 flex-1 leading-snug")}>
            {field.id === "subtotal_ex_tax"
              ? "Subtotal"
              : field.id === "transaction_discount"
                ? "Trade disc."
                : field.id === "shipping_tax_amount"
                  ? "Ship tax %"
                  : field.id === "additional_charges_amount"
                    ? "Add'l charges"
                    : field.label}
          </dt>
          <dd
            className={previewValueClass(
              field,
              cn(
                "shrink-0 text-right tabular-nums",
                field.id === "grand_total" && !resolveColumnTypography(field, "value")?.fontWeight && "font-semibold"
              )
            )}
          >
            {previewTotalsValue(field)}
          </dd>
        </div>
      ))}
    </div>
  );
}

function NotesPreviewSection({ field }: { field: DocumentColumnPref }) {
  return (
    <div className="surface-inset min-w-0 p-3">
      <div className="min-h-[4.5rem] rounded-md border border-border/60 bg-background/80 px-2 py-1.5 text-sm text-muted-foreground">
        Internal notes
      </div>
      <span className="sr-only">{field.label}</span>
    </div>
  );
}

function previewTotalsValue(field: DocumentColumnPref): string {
  const raw = PREVIEW_TOTALS_RAW[field.id];
  if (raw == null) return "…";
  if (field.id === "line_count") return raw;
  return formatDocumentDecimal(raw, resolveColumnDecimalPlaces(field));
}

function previewLabelClass(field: Pick<DocumentColumnPref, "typography" | "labelTypography" | "valueTypography">, className?: string) {
  return documentFieldLabelTypographyClassName(field, cn("truncate text-xs text-muted-foreground", className));
}

function previewValueClass(field: Pick<DocumentColumnPref, "typography" | "labelTypography" | "valueTypography">, className?: string) {
  return documentFieldValueTypographyClassName(
    field,
    cn("truncate text-sm text-foreground", !resolveColumnTypography(field, "value")?.fontWeight && "font-medium", className)
  );
}

function previewColumnHeaderClass(column: DocumentColumnPref) {
  return documentFieldLabelTypographyClassName(
    column,
    cn(
      "px-1.5 py-1.5",
      !resolveColumnTypography(column, "label")?.fontWeight && "font-medium",
      column.align === "right" && "text-right",
      column.align === "center" && "text-center"
    )
  );
}
function previewCellClass(column: DocumentColumnPref): string {
  return documentTypographyClassName(
    resolveColumnTypography(column, "value"),
    cn(
      column.align === "right" && "text-right tabular-nums",
      column.align === "center" && "text-center",
      column.id === "item" && !resolveColumnTypography(column, "value")?.fontWeight && "font-medium text-foreground",
      column.id === "item" && resolveColumnTypography(column, "value")?.fontWeight && "text-foreground",
      column.id !== "item" && column.group === "line" && "text-muted-foreground"
    )
  );
}

function DetailPreviewRows({ columns }: { columns: ReturnType<typeof getItemDetailLineFields> }) {
  const rows = groupItemDetailRows(columns);
  if (rows.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-1 border-t border-border/50 pt-1.5 text-xs leading-snug text-muted-foreground">
      {rows.map((rowColumns, rowIndex) =>
        rowColumns.length > 1 ? (
          <div key={`row-${rowIndex}`} className="flex flex-wrap items-baseline gap-x-1.5">
            {rowColumns.map((column, columnIndex) => (
              <span key={column.id} className="inline-flex items-baseline gap-0.5">
                {columnIndex > 0 ? <span className="text-muted-foreground/45">·</span> : null}
                {column.showLabel !== false ? (
                  <span className={previewLabelClass(column, "text-muted-foreground")}>{column.label}:</span>
                ) : null}
                <span className={previewValueClass(column, "text-foreground/80")}>…</span>
              </span>
            ))}
          </div>
        ) : (
          <div key={rowColumns[0]!.id} className="flex gap-1">
            {rowColumns[0]!.showLabel !== false ? (
              <span className={previewLabelClass(rowColumns[0]!, "text-muted-foreground")}>
                {rowColumns[0]!.label}:
              </span>
            ) : null}
            <span className={previewValueClass(rowColumns[0]!, "text-foreground/80")}>…</span>
          </div>
        )
      )}
    </div>
  );
}

function HeaderFieldPreview({
  field,
  className,
}: {
  field: DocumentColumnPref;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-0.5", className)}>
      <p className={previewLabelClass(field)}>{field.label}</p>
      <p className={previewValueClass(field)}>{PREVIEW_HEADER_SAMPLE[field.id] ?? "…"}</p>
    </div>
  );
}

export function DocumentLayoutPreview({ layout, previewMode, onPreviewModeChange }: Props) {
  const peekHeaderFields = getVisibleHeaderFields(layout);
  const primaryHeaderFields = getVisiblePoFormHeaderPrimaryFields(layout);
  const detailsHeaderFields = getVisiblePoFormHeaderDetailsFields(layout);
  const totalsFields = getVisibleTotalsFields(layout);
  const lineColumns = getPoLineEntryTableColumns(layout);
  const detailColumns = getItemDetailLineFields(layout);
  const showUnitUnderQty = shouldShowPoUnitUnderQtyColumn(layout);
  const showInlineImage = shouldShowPoLineInlineImage(layout.imageDisplayMode);
  const showImageColumn = layout.imageDisplayMode === "SEPARATE_COLUMN";
  const drawerPrimaryGrid = resolvePoFormFieldsGridProps(primaryHeaderFields.length);
  const peekHeaderGrid = resolvePoFormFieldsGridProps(peekHeaderFields.length);
  const notesField = getVisiblePoFormHeaderNotesField(layout);

  const linesTable = (
    <div className="table-chrome-frame overflow-x-auto rounded-md border border-border bg-background">
      <table data-header-tone="subtle" className="table-chrome w-full min-w-0 border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <th className="w-8 px-1 py-1.5 text-center font-medium">#</th>
            {lineColumns.map((column) => (
              <th
                key={column.id}
                className={cn(
                  previewColumnHeaderClass(column),
                  column.id === PO_LINE_IMAGE_COLUMN_ID && "w-10 px-0"
                )}
              >
                {column.id === PO_LINE_IMAGE_COLUMN_ID ? "" : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border last:border-0">
            <td className="border-r border-border px-1 py-2 text-center text-xs tabular-nums text-muted-foreground">
              1
            </td>
            {lineColumns.map((column) => (
              <td
                key={column.id}
                className={cn(
                  "border-r border-border last:border-r-0",
                  "px-1.5 py-2 align-top",
                  column.id === "quantity_ordered" && showUnitUnderQty && "p-0",
                  previewCellClass(column)
                )}
              >
                {column.id === PO_LINE_IMAGE_COLUMN_ID ? (
                  showImageColumn ? (
                    <div className="flex justify-center">
                      <DocumentLineImage imageUrl={null} size="sm" />
                    </div>
                  ) : null
                ) : column.id === "item" ? (
                  <div className="flex items-start gap-2">
                    {showInlineImage ? (
                      <DocumentLineImage imageUrl={null} size="sm" className="mt-0.5 shrink-0" />
                    ) : null}
                    <div className="min-w-0">
                      <div className={previewValueClass(column, "truncate leading-snug")}>Sample item</div>
                      {detailColumns.length > 0 ? (
                        <DetailPreviewRows columns={detailColumns} />
                      ) : null}
                    </div>
                  </div>
                ) : column.id === "quantity_ordered" ? (
                  <PoLineQtyValueStack
                    showUnitUnderQty={showUnitUnderQty}
                    align={column.align}
                    unitSlot={
                      <PoLineQtyUnitSlot
                        unitCode={PREVIEW_LINE_RAW.unit ?? "EA"}
                        align={column.align}
                        className="w-full px-0"
                      />
                    }
                  >
                        <span
                          className={cn(
                            previewValueClass(column, "block h-8 leading-8 tabular-nums"),
                            column.align === "right" ? "text-right" : "text-left"
                          )}
                        >
                      {previewLineValue(column)}
                    </span>
                  </PoLineQtyValueStack>
                ) : (
                  <span className={previewValueClass(column)}>{previewLineValue(column)}</span>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );

  const peekTotals = totalsFields.length > 0 ? (
    <dl className="mt-3 space-y-1.5 border-t border-border pt-3">
      {totalsFields.map((field) => (
        <div key={field.id} className="flex items-baseline justify-between gap-3">
          <dt className={previewLabelClass(field, "text-sm")}>
            {field.label}
          </dt>
          <dd
            className={previewValueClass(
              field,
              cn(
                "tabular-nums",
                field.id === "grand_total" && !resolveColumnTypography(field, "value")?.fontWeight && "text-base font-semibold"
              )
            )}
          >
            {previewTotalsValue(field)}
          </dd>
        </div>
      ))}
    </dl>
  ) : null;

  const drawerSideRail = (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden",
        PO_DRAWER_WIDE_SIDE_RAIL_CLASS
      )}
    >
      <div className="flex flex-col gap-3">
        {totalsFields.length > 0 ? (
          <section className="flex shrink-0 flex-col gap-1.5">
            <p className={PREVIEW_SECTION_TITLE_CLASS}>Summary</p>
            <TotalsPreviewPanel fields={totalsFields} />
          </section>
        ) : null}
        {detailsHeaderFields.length > 0 ? (
          <section className="flex shrink-0 flex-col gap-1.5">
            <p className={PREVIEW_SECTION_TITLE_CLASS}>Details</p>
            <div className="surface-inset min-w-0 space-y-1 p-3">
              {detailsHeaderFields.map((field) => (
                <DetailsFieldPreviewRow key={field.id} field={field} />
              ))}
            </div>
          </section>
        ) : null}
        {notesField ? (
          <section className="flex shrink-0 flex-col gap-1.5">
            <p className={PREVIEW_SECTION_TITLE_CLASS}>Notes</p>
            <NotesPreviewSection field={notesField} />
          </section>
        ) : null}
      </div>
    </aside>
  );

  return (
    <div className="w-full min-w-0 space-y-2.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
          <button
            type="button"
            className={cn(
              "rounded px-2.5 py-1 font-medium transition-colors",
              previewMode === "drawer"
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onPreviewModeChange("drawer")}
          >
            Drawer
          </button>
          <button
            type="button"
            className={cn(
              "rounded px-2.5 py-1 font-medium transition-colors",
              previewMode === "peek"
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onPreviewModeChange("peek")}
          >
            Peek
          </button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/20 p-3 shadow-sm">
        {previewMode === "peek" ? (
          <>
            <PoAddressBlocks blocks={PREVIEW_PO_ADDRESS_BLOCKS} compact className="mb-3" />

            {peekHeaderFields.length > 0 ? (
              <div className={cn("mb-3", peekHeaderGrid.containerClassName)}>
                <div className={cn(peekHeaderGrid.gridClassName, "gap-x-3 gap-y-2")}>
                  {peekHeaderFields.slice(0, 6).map((field) => (
                    <HeaderFieldPreview key={field.id} field={field} />
                  ))}
                </div>
              </div>
            ) : null}

            {linesTable}
            {peekTotals}
          </>
        ) : (
          <section className="flex min-w-0 flex-col gap-4 md:flex-row md:items-stretch">
            <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-3 overflow-hidden">
              {primaryHeaderFields.length > 0 ? (
                <div className={cn("shrink-0 min-w-0", drawerPrimaryGrid.containerClassName)}>
                  <div className={cn(drawerPrimaryGrid.gridClassName, "gap-x-3 gap-y-2")}>
                    {primaryHeaderFields.map((field) => (
                      <HeaderFieldPreview key={field.id} field={field} />
                    ))}
                  </div>
                </div>
              ) : null}
              <p className={PREVIEW_SECTION_TITLE_CLASS}>Lines</p>
              {linesTable}
            </div>
            <div className="min-h-0 shrink-0 self-stretch md:h-full md:w-auto">{drawerSideRail}</div>
          </section>
        )}
      </div>
    </div>
  );
}
