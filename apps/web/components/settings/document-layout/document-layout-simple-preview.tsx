"use client";

import { documentTypographyClassName } from "@/lib/documents/document-typography-classes";
import { formatDocumentDecimal, resolveColumnDecimalPlaces } from "@/lib/documents/decimal-format";
import { DOCUMENT_LAYOUT_MODULE_ADAPTERS } from "@/lib/documents/document-layout-module-adapters";
import { getVisibleHeaderFields as getVisibleGrnHeaderFields, getVisibleGrnLineColumns } from "@/lib/documents/goods-receipt-layout";
import {
  getVisibleHeaderFields as getVisibleBillHeaderFields,
  getVisibleBillLineColumns,
  getVisibleTotalsFields as getVisibleBillTotalsFields,
} from "@/lib/documents/purchase-invoice-layout";
import type { DocumentColumnPref, DocumentLayoutTemplate } from "@/lib/documents/types";
import { cn } from "@/lib/utils";

type PreviewMode = "drawer" | "peek";

type Props = {
  layout: DocumentLayoutTemplate;
  previewMode: PreviewMode;
  onPreviewModeChange: (mode: PreviewMode) => void;
};

function previewHeaderValue(field: DocumentColumnPref): string {
  const samples: Record<string, string> = {
    destination: "Main warehouse",
    purchase_order: "PO-00042",
    voucher_number: "GRN-00018",
    received_at: "Jun 14, 2026",
    supplier: "Acme Supplies",
    invoice_number_vendor: "INV-9021",
    system_voucher_number: "PI-00012",
    match_status: "Matched",
    tax_treatment: "Regular B2B",
    created_at: "Jun 14, 2026",
    is_qc_pending: "No",
  };
  return samples[field.id] ?? "…";
}

function PreviewHeaderField({ field }: { field: DocumentColumnPref }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className={documentTypographyClassName(field.typography, "truncate text-xs text-muted-foreground")}>
        {field.label}
      </p>
      <p className="truncate text-sm font-medium text-foreground">{previewHeaderValue(field)}</p>
    </div>
  );
}

function PreviewLineTable({ columns }: { columns: DocumentColumnPref[] }) {
  if (columns.length === 0) return null;

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border/60 text-muted-foreground">
          {columns.map((column) => (
            <th
              key={column.id}
              className={cn(
                "px-1 py-1 font-medium",
                column.align === "right" && "text-right",
                column.align === "center" && "text-center"
              )}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-border/40">
          {columns.map((column) => (
            <td
              key={column.id}
              className={cn(
                "px-1 py-1.5 text-muted-foreground",
                column.align === "right" && "text-right tabular-nums",
                column.align === "center" && "text-center",
                column.id === "item" && "font-medium text-foreground"
              )}
            >
              {column.id === "item" ? "Sample item" : formatDocumentDecimal("1", resolveColumnDecimalPlaces(column))}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

export function DocumentLayoutSimplePreview({ layout, previewMode, onPreviewModeChange }: Props) {
  const adapter = DOCUMENT_LAYOUT_MODULE_ADAPTERS[layout.moduleKey as "GOODS_RECEIPT_NOTE" | "PURCHASE_INVOICE"];
  const normalized = adapter?.normalize(layout) ?? layout;

  const headerFields =
    layout.moduleKey === "GOODS_RECEIPT_NOTE"
      ? getVisibleGrnHeaderFields(normalized)
      : getVisibleBillHeaderFields(normalized);

  const lineColumns =
    layout.moduleKey === "GOODS_RECEIPT_NOTE"
      ? getVisibleGrnLineColumns(normalized)
      : getVisibleBillLineColumns(normalized);

  const totalsFields =
    layout.moduleKey === "PURCHASE_INVOICE" ? getVisibleBillTotalsFields(normalized) : [];

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

      {headerFields.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {headerFields.slice(0, previewMode === "peek" ? 6 : 4).map((field) => (
            <PreviewHeaderField key={field.id} field={field} />
          ))}
        </div>
      ) : null}

      <PreviewLineTable columns={lineColumns} />

      {totalsFields.length > 0 ? (
        <div className="space-y-1 border-t border-border/60 pt-2">
          {totalsFields.map((field) => (
            <div key={field.id} className="flex justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{field.label}</span>
              <span className="font-medium tabular-nums">
                {formatDocumentDecimal("100.00", resolveColumnDecimalPlaces(field))}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
