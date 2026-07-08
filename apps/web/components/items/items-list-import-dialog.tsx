"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { importProductListRows, importProductSkuRows } from "@/app/items/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import {
  buildImportPreviewRows,
  buildProductListImportPreview,
  parseProductListSpreadsheetFile,
} from "@/lib/products/list-import";
import {
  buildProductSkuImportPreview,
  buildSkuImportPreviewRows,
  detectDuplicateSkusInFile,
  skuImportTemplateCsv,
  type ProductSkuImportRow,
} from "@/lib/products/list-sku-import";
import { downloadExportBlob } from "@/lib/products/list-export";

type ImportMode = "product" | "sku";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
};

export function ItemsListImportDialog({ open, onOpenChange, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>("product");
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [mappedColumnCount, setMappedColumnCount] = useState(0);
  const [attributeColumnCount, setAttributeColumnCount] = useState(0);
  const [duplicateSkus, setDuplicateSkus] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<
    Array<{ rowNumber: number; values: Partial<Record<ProductListColumnId, string>> }>
  >([]);
  const [parsedSkuRows, setParsedSkuRows] = useState<ProductSkuImportRow[]>([]);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setFileName(null);
    setPreviewHeaders([]);
    setPreviewRows([]);
    setMappedColumnCount(0);
    setAttributeColumnCount(0);
    setDuplicateSkus([]);
    setParsedRows([]);
    setParsedSkuRows([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleModeChange = (nextMode: ImportMode) => {
    setMode(nextMode);
    reset();
  };

  const handleDownloadTemplate = () => {
    const csv = skuImportTemplateCsv();
    downloadExportBlob(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }),
      "items-sku-import-template.csv"
    );
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      reset();
      return;
    }

    startTransition(async () => {
      try {
        const sheet = await parseProductListSpreadsheetFile(file);
        if (sheet.headers.length === 0 || sheet.rows.length === 0) {
          toast.error("The selected file has no importable rows.");
          reset();
          return;
        }

        if (mode === "sku") {
          const nextPreview = buildProductSkuImportPreview(sheet);
          if (nextPreview.mappedColumnIds.length === 0) {
            toast.error("No recognized column headers found. Download the SKU template to get started.");
            reset();
            return;
          }

          const allSkuRows = buildSkuImportPreviewRows(sheet);
          const duplicates = detectDuplicateSkusInFile(allSkuRows);
          if (duplicates.length > 0) {
            toast.error(`Duplicate SKUs in file: ${duplicates.join(", ")}`);
          }

          setFileName(file.name);
          setPreviewHeaders(sheet.headers);
          setPreviewRows(sheet.rows.slice(0, 8));
          setMappedColumnCount(nextPreview.mappedColumnIds.length);
          setAttributeColumnCount(nextPreview.attributeHeaders.length);
          setDuplicateSkus(duplicates);
          setParsedSkuRows(allSkuRows);
          setParsedRows([]);
          return;
        }

        const nextPreview = buildProductListImportPreview(sheet);
        if (nextPreview.mappedColumnIds.length === 0) {
          toast.error("No recognized column headers found. Use the export template column labels.");
          reset();
          return;
        }

        setFileName(file.name);
        setPreviewHeaders(sheet.headers);
        setPreviewRows(sheet.rows.slice(0, 8));
        setMappedColumnCount(nextPreview.mappedColumnIds.length);
        setAttributeColumnCount(0);
        setDuplicateSkus([]);
        setParsedRows(buildImportPreviewRows(sheet));
        setParsedSkuRows([]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to read the selected file.");
        reset();
      }
    });
  };

  const handleImport = () => {
    if (mode === "sku") {
      if (parsedSkuRows.length === 0) {
        toast.error("Choose a CSV or Excel file to import.");
        return;
      }
      if (duplicateSkus.length > 0) {
        toast.error(`Fix duplicate SKUs before importing: ${duplicateSkus.join(", ")}`);
        return;
      }

      startTransition(async () => {
        const result = await importProductSkuRows(parsedSkuRows);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }

        if (result.imported === 0 && result.updated === 0) {
          toast.error("No rows were imported or updated.");
          if (result.errors.length > 0) {
            toast.error(result.errors.slice(0, 3).join(" "));
          }
          return;
        }

        const parts = [
          result.imported > 0
            ? `${result.imported} new SKU${result.imported === 1 ? "" : "s"}`
            : null,
          result.updated > 0
            ? `${result.updated} updated SKU${result.updated === 1 ? "" : "s"}`
            : null,
        ].filter(Boolean);
        const failureSuffix =
          result.failed > 0 ? ` ${result.failed} row${result.failed === 1 ? "" : "s"} failed.` : "";
        toast.success(`Imported ${parts.join(" and ")}.${failureSuffix}`);
        if (result.errors.length > 0) {
          toast.error(result.errors.slice(0, 3).join(" "));
        }
        onImported?.();
        onOpenChange(false);
        reset();
      });
      return;
    }

    if (parsedRows.length === 0) {
      toast.error("Choose a CSV or Excel file to import.");
      return;
    }

    startTransition(async () => {
      const result = await importProductListRows(parsedRows);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if (result.imported === 0) {
        toast.error("No rows contained a product name to import.");
        return;
      }

      const failureSuffix =
        result.failed > 0 ? ` ${result.failed} row${result.failed === 1 ? "" : "s"} failed.` : "";
      toast.success(
        `Imported ${result.imported} item${result.imported === 1 ? "" : "s"}.${failureSuffix}`
      );
      onImported?.();
      onOpenChange(false);
      reset();
    });
  };

  const canImport =
    mode === "sku"
      ? parsedSkuRows.length > 0 && duplicateSkus.length === 0
      : parsedRows.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import items</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file. Choose simple product import or SKU upsert for one row per
            sellable SKU.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Import mode</Label>
            <RadioGroup
              value={mode}
              onValueChange={(value) => handleModeChange(value as ImportMode)}
              className="grid gap-2"
            >
              {(
                [
                  {
                    id: "product",
                    label: "Simple (one row per product)",
                    hint: "Creates or updates products from Name and shared item fields.",
                  },
                  {
                    id: "sku",
                    label: "SKU (one row per sellable SKU)",
                    hint: "Upserts by SKU; updates prices and attributes on existing SKUs.",
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"
                >
                  <RadioGroupItem value={option.id} className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="block font-medium">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {mode === "sku" ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Use Product code to group SKUs under one product. SKU is the upsert key.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate}>
                Download template
              </Button>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="items-import-file">File</Label>
            <Input
              ref={inputRef}
              id="items-import-file"
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileChange}
            />
            {fileName ? <p className="text-xs text-muted-foreground">{fileName}</p> : null}
          </div>

          {previewHeaders.length > 0 ? (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="max-h-40 overflow-auto rounded-md border border-border/70">
                <table className="min-w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      {previewHeaders.map((header) => (
                        <th key={header} className="px-2 py-1 text-left font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((cells, rowIndex) => (
                      <tr key={rowIndex} className="border-t border-border/50">
                        {previewHeaders.map((header, columnIndex) => (
                          <td key={`${rowIndex}-${header}`} className="px-2 py-1 align-top">
                            {cells[columnIndex] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Recognized {mappedColumnCount} column{mappedColumnCount === 1 ? "" : "s"}
                {mode === "sku" && attributeColumnCount > 0
                  ? ` and ${attributeColumnCount} attribute column${attributeColumnCount === 1 ? "" : "s"}.`
                  : "."}
              </p>
              {duplicateSkus.length > 0 ? (
                <p className="text-xs text-destructive">
                  Duplicate SKUs: {duplicateSkus.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={isPending || !canImport} onClick={handleImport}>
            {isPending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
