"use client";

import {
  getItemDetailLineFields,
  getFlatPoLineColumns,
  getPoLineEntryTableColumns,
  getVisibleHeaderFields,
  getVisibleTotalsFields,
  PO_LINE_IMAGE_COLUMN_ID,
  shouldShowPoLineInlineImage,
} from "@/lib/documents/purchase-order-layout";
import { groupItemDetailRows } from "@/lib/documents/item-detail-rows";
import { documentTypographyClassName } from "@/lib/documents/document-typography-classes";
import { DocumentLineImage } from "@/components/documents/document-line-image";
import type { DocumentColumnPref, DocumentLayoutTemplate } from "@/lib/documents/types";
import { cn } from "@/lib/utils";

type PreviewMode = "drawer" | "peek";

type Props = {
  layout: DocumentLayoutTemplate;
  previewMode: PreviewMode;
  onPreviewModeChange: (mode: PreviewMode) => void;
};

const PREVIEW_LINE_SAMPLE: Partial<Record<string, string>> = {
  quantity_ordered: "1.000",
  unit: "EA",
  unit_price: "10.00",
  line_total: "10.00",
  discount_pct: "0.00",
  discount_amount: "0.00",
};

const PREVIEW_TOTALS_SAMPLE: Partial<Record<string, string>> = {
  line_count: "1",
  subtotal_ex_tax: "10.00",
  tax_amount: "0.00",
  grand_total: "10.00",
};

const PREVIEW_HEADER_SAMPLE: Partial<Record<string, string>> = {
  supplier: "Acme Supplies",
  destination: "Main warehouse",
  currency: "USD",
  voucher_number: "PO-00042",
  payment_terms_days: "30",
};

function previewCellClass(column: DocumentColumnPref): string {
  return documentTypographyClassName(
    column.typography,
    cn(
      column.align === "right" && "text-right tabular-nums",
      column.align === "center" && "text-center",
      column.id === "item" && "font-medium text-foreground",
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
                {column.showLabel !== false ? <span>{column.label}:</span> : null}
                <span className="text-foreground/80">…</span>
              </span>
            ))}
          </div>
        ) : (
          <div key={rowColumns[0]!.id} className="flex gap-1">
            {rowColumns[0]!.showLabel !== false ? <span>{rowColumns[0]!.label}:</span> : null}
            <span className="text-foreground/80">…</span>
          </div>
        )
      )}
    </div>
  );
}

export function DocumentLayoutPreview({ layout, previewMode, onPreviewModeChange }: Props) {
  const headerFields = getVisibleHeaderFields(layout);
  const totalsFields = getVisibleTotalsFields(layout);
  const lineColumns =
    previewMode === "drawer" ? getPoLineEntryTableColumns(layout) : getFlatPoLineColumns(layout);
  const detailColumns = previewMode === "drawer" ? getItemDetailLineFields(layout) : [];
  const showInlineImage = shouldShowPoLineInlineImage(layout.imageDisplayMode);
  const showImageColumn = layout.imageDisplayMode === "SEPARATE_COLUMN";

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
        {headerFields.length > 0 ? (
          <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-2">
            {headerFields.slice(0, 6).map((field) => (
              <div key={field.id} className="min-w-0 space-y-0.5">
                <p
                  className={documentTypographyClassName(
                    field.typography,
                    "truncate text-xs text-muted-foreground"
                  )}
                >
                  {field.label}
                </p>
                <p className="truncate text-sm font-medium text-foreground">
                  {PREVIEW_HEADER_SAMPLE[field.id] ?? "…"}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-md border border-border bg-background">
          <table className="w-full min-w-0 border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="w-8 px-1 py-1.5 text-center font-medium">#</th>
                {lineColumns.map((column) => (
                  <th
                    key={column.id}
                    className={cn(
                      "px-1.5 py-1.5 font-medium",
                      column.id === PO_LINE_IMAGE_COLUMN_ID && "w-10 px-0",
                      column.align === "right" && "text-right",
                      column.align === "center" && "text-center"
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
                      "border-r border-border px-1.5 py-2 align-top last:border-r-0",
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
                          <div className="truncate font-medium leading-snug">Sample item</div>
                          {detailColumns.length > 0 ? (
                            <DetailPreviewRows columns={detailColumns} />
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <span>{PREVIEW_LINE_SAMPLE[column.id] ?? "…"}</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {totalsFields.length > 0 ? (
          <dl className="mt-3 space-y-1.5 border-t border-border pt-3">
            {totalsFields.map((field) => (
              <div key={field.id} className="flex items-baseline justify-between gap-3">
                <dt
                  className={documentTypographyClassName(
                    field.typography,
                    "text-sm text-muted-foreground"
                  )}
                >
                  {field.label}
                </dt>
                <dd
                  className={documentTypographyClassName(
                    field.typography,
                    cn(
                      "tabular-nums",
                      field.id === "grand_total"
                        ? "text-base font-semibold text-foreground"
                        : "text-sm font-medium text-foreground"
                    )
                  )}
                >
                  {PREVIEW_TOTALS_SAMPLE[field.id] ?? "…"}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </div>
  );
}
