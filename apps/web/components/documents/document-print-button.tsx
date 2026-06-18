"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  downloadDocumentPdf,
  loadDocumentPrintPayload,
} from "@/lib/documents/document-print-actions";
import { downloadPdfFromBase64 } from "@/lib/documents/download-document-pdf";
import {
  prepareDocumentPrintWindow,
  renderDocumentPrintWindow,
} from "@/lib/documents/open-document-print-window";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DocumentModuleKey } from "@/lib/documents/types";

type Props = {
  moduleKey: DocumentModuleKey;
  documentId: string;
  documentLocationId?: string | null;
  label?: string;
  className?: string;
  size?: "sm" | "default";
  variant?: "ghost" | "outline" | "secondary" | "default";
};

export function DocumentPrintButton({
  moduleKey,
  documentId,
  documentLocationId,
  label = "Print",
  className,
  size = "sm",
  variant = "outline",
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const runPrint = () => {
    let printWindow: Window | null = null;

    try {
      printWindow = prepareDocumentPrintWindow();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to open print preview."
      );
      return;
    }

    startTransition(async () => {
      setBusy(true);
      const result = await loadDocumentPrintPayload({
        moduleKey,
        documentId,
        documentLocationId,
      });
      setBusy(false);

      if ("error" in result) {
        printWindow?.close();
        toast.error(result.error ?? "Unable to print document.");
        return;
      }

      try {
        renderDocumentPrintWindow(
          printWindow!,
          result.payload.title,
          result.payload.html
        );
      } catch (error) {
        printWindow?.close();
        toast.error(
          error instanceof Error ? error.message : "Unable to open print preview."
        );
      }
    });
  };

  const runDownload = () => {
    startTransition(async () => {
      setBusy(true);
      const result = await downloadDocumentPdf({
        moduleKey,
        documentId,
        documentLocationId,
      });
      setBusy(false);

      if ("error" in result) {
        toast.error(result.error ?? "Unable to download PDF.");
        return;
      }

      downloadPdfFromBase64(result.filename, result.pdfBase64);
      toast.success("PDF downloaded.");
    });
  };

  const disabled = isPending || busy;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size={size}
          variant={variant}
          className={className}
          disabled={disabled}
        >
          <Printer className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          {disabled ? "Preparing…" : label}
          <ChevronDown className="ml-1 h-3 w-3 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem disabled={disabled} onClick={runPrint}>
          <Printer className="mr-2 h-3.5 w-3.5" aria-hidden />
          Print
        </DropdownMenuItem>
        <DropdownMenuItem disabled={disabled} onClick={runDownload}>
          <Download className="mr-2 h-3.5 w-3.5" aria-hidden />
          Download PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
