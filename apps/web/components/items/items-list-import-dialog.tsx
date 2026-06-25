"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { importProductListRows } from "@/app/items/actions";
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
import type { ProductListColumnId } from "@/lib/products/list-columns";
import {
  buildImportPreviewRows,
  buildProductListImportPreview,
  parseProductListSpreadsheetFile,
} from "@/lib/products/list-import";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
};

export function ItemsListImportDialog({ open, onOpenChange, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [mappedColumnCount, setMappedColumnCount] = useState(0);
  const [parsedRows, setParsedRows] = useState<
    Array<{ rowNumber: number; values: Partial<Record<ProductListColumnId, string>> }>
  >([]);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setFileName(null);
    setPreviewHeaders([]);
    setPreviewRows([]);
    setMappedColumnCount(0);
    setParsedRows([]);
    if (inputRef.current) inputRef.current.value = "";
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
        setParsedRows(buildImportPreviewRows(sheet));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to read the selected file.");
        reset();
      }
    });
  };

  const handleImport = () => {
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
            Upload a CSV or Excel file using the same column labels as export. Rows need at least a
            Name column; SKU can be left blank when auto-generation is enabled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
                Recognized {mappedColumnCount} column{mappedColumnCount === 1 ? "" : "s"}.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={isPending || parsedRows.length === 0} onClick={handleImport}>
            {isPending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
