"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { exportProductListPdf } from "@/app/items/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { downloadPdfFromBase64 } from "@/lib/documents/download-document-pdf";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import {
  buildProductListExportMatrix,
  downloadProductListCsvFromMatrix,
  downloadProductListExcelFromMatrix,
  renderProductListExportTableHtml,
  resolveProductListExportColumns,
  resolveProductListPdfLandscape,
  resolveProductListPdfOrientationLabel,
  type ProductListExportFormat,
} from "@/lib/products/list-export";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import type { ProductListRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";

const PDF_PREVIEW_ROW_LIMIT = 8;

export type ItemsListExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldPermissions: ProductFieldPermissions;
  defaultColumnIds: ProductListColumnId[];
  rowCount: number;
  previewRows?: ProductListRow[];
  resolveRows: () => Promise<ProductListRow[]>;
};

export function ItemsListExportDialog({
  open,
  onOpenChange,
  fieldPermissions,
  defaultColumnIds,
  rowCount,
  previewRows = [],
  resolveRows,
}: ItemsListExportDialogProps) {
  const exportableColumns = useMemo(
    () =>
      resolveProductListExportColumns(
        fieldPermissions.allowedFields as ProductListColumnId[],
        fieldPermissions
      ),
    [fieldPermissions]
  );

  const initialSelectedColumnIds = useMemo(() => {
    const allowed = new Set(exportableColumns.map((column) => column.id));
    const preferred = defaultColumnIds.filter((columnId) => allowed.has(columnId));
    return preferred.length > 0 ? preferred : exportableColumns.map((column) => column.id);
  }, [defaultColumnIds, exportableColumns]);

  const [selectedColumnIds, setSelectedColumnIds] =
    useState<ProductListColumnId[]>(initialSelectedColumnIds);
  const [format, setFormat] = useState<ProductListExportFormat>("csv");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setSelectedColumnIds(initialSelectedColumnIds);
    }
  }, [initialSelectedColumnIds, open]);

  const allSelected =
    selectedColumnIds.length === exportableColumns.length && exportableColumns.length > 0;

  const pdfLandscape = resolveProductListPdfLandscape(selectedColumnIds.length);
  const pdfOrientationLabel = resolveProductListPdfOrientationLabel(selectedColumnIds.length);

  const pdfPreviewHtml = useMemo(() => {
    if (format !== "pdf" || selectedColumnIds.length === 0) {
      return null;
    }

    const rowsForPreview = previewRows.slice(0, PDF_PREVIEW_ROW_LIMIT);
    if (rowsForPreview.length === 0) {
      return null;
    }

    const matrix = buildProductListExportMatrix(rowsForPreview, selectedColumnIds, fieldPermissions);
    return renderProductListExportTableHtml(matrix, "Items export (preview)", { landscape: pdfLandscape });
  }, [fieldPermissions, format, pdfLandscape, previewRows, selectedColumnIds]);

  const toggleColumn = (columnId: ProductListColumnId, checked: boolean) => {
    setSelectedColumnIds((current) => {
      if (checked) {
        return current.includes(columnId) ? current : [...current, columnId];
      }
      return current.filter((id) => id !== columnId);
    });
  };

  const handleExport = () => {
    if (selectedColumnIds.length === 0) {
      toast.error("Select at least one column to export.");
      return;
    }

    startTransition(async () => {
      try {
        const rows = await resolveRows();
        if (rows.length === 0) {
          toast.error("No items match the current filter.");
          return;
        }

        const matrix = buildProductListExportMatrix(rows, selectedColumnIds, fieldPermissions);

        if (format === "csv") {
          downloadProductListCsvFromMatrix(matrix);
          toast.success(`Exported ${rows.length} item${rows.length === 1 ? "" : "s"} as CSV.`);
          onOpenChange(false);
          return;
        }

        if (format === "excel") {
          await downloadProductListExcelFromMatrix(matrix);
          toast.success(`Exported ${rows.length} item${rows.length === 1 ? "" : "s"} as Excel.`);
          onOpenChange(false);
          return;
        }

        const result = await exportProductListPdf({
          headers: matrix.headers,
          rows: matrix.rows,
          title: "Items export",
        });

        if ("error" in result) {
          toast.error(result.error ?? "Unable to export PDF.");
          return;
        }

        downloadPdfFromBase64(result.filename, result.pdfBase64);
        toast.success(`Exported ${rows.length} item${rows.length === 1 ? "" : "s"} as PDF.`);
        onOpenChange(false);
      } catch {
        toast.error("Unable to export items.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-lg", format === "pdf" && "max-w-3xl")}>
        <DialogHeader>
          <DialogTitle>Export items</DialogTitle>
          <DialogDescription>
            Export {rowCount} item{rowCount === 1 ? "" : "s"} matching the current filters. Choose
            columns and file format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Columns</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() =>
                  setSelectedColumnIds(
                    allSelected ? [] : exportableColumns.map((column) => column.id)
                  )
                }
              >
                {allSelected ? "Clear all" : "Select all"}
              </Button>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border/70 p-3">
              {exportableColumns.map((column) => (
                <label
                  key={column.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={selectedColumnIds.includes(column.id)}
                    onCheckedChange={(checked) => toggleColumn(column.id, checked === true)}
                  />
                  <span>{column.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Format</Label>
            <RadioGroup
              value={format}
              onValueChange={(value) => setFormat(value as ProductListExportFormat)}
              className="grid grid-cols-3 gap-2"
            >
              {(
                [
                  { id: "csv", label: "CSV" },
                  { id: "excel", label: "Excel" },
                  { id: "pdf", label: "PDF" },
                ] as const
              ).map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"
                >
                  <RadioGroupItem value={option.id} />
                  {option.label}
                </label>
              ))}
            </RadioGroup>
          </div>

          {format === "pdf" ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>PDF preview</Label>
                <Badge variant="active" className="capitalize">
                  {pdfOrientationLabel}
                  {pdfLandscape ? " (auto)" : ""}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {pdfLandscape
                  ? "Landscape is used automatically when seven or more columns are selected."
                  : "Portrait is used for six or fewer columns."}
              </p>
              {pdfPreviewHtml ? (
                <div
                  className={cn(
                    "overflow-hidden rounded-md border border-border/70 bg-muted/30",
                    pdfLandscape ? "aspect-[297/210]" : "aspect-[210/297]"
                  )}
                >
                  <iframe
                    title="PDF export preview"
                    srcDoc={pdfPreviewHtml}
                    className="h-full w-full border-0 bg-white"
                    sandbox=""
                  />
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
                  Select columns to preview the PDF layout.
                </p>
              )}
              {rowCount > PDF_PREVIEW_ROW_LIMIT ? (
                <p className="text-xs text-muted-foreground">
                  Preview shows the first {PDF_PREVIEW_ROW_LIMIT} rows; the download includes all{" "}
                  {rowCount} items.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={isPending} onClick={handleExport}>
            {isPending ? "Exporting…" : format === "pdf" ? "Download PDF" : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
