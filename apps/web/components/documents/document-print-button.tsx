"use client";

import { useState, useTransition } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loadDocumentPrintPayload } from "@/lib/documents/document-print-actions";
import { openDocumentPrintWindow } from "@/lib/documents/open-document-print-window";
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

  const handlePrint = () => {
    startTransition(async () => {
      setBusy(true);
      const result = await loadDocumentPrintPayload({
        moduleKey,
        documentId,
        documentLocationId,
      });
      setBusy(false);

      if ("error" in result) {
        toast.error(result.error ?? "Unable to print document.");
        return;
      }

      openDocumentPrintWindow(result.payload.title, result.payload.model);
    });
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      disabled={isPending || busy}
      onClick={handlePrint}
    >
      <Printer className="mr-1.5 h-3.5 w-3.5" aria-hidden />
      {isPending || busy ? "Preparing…" : label}
    </Button>
  );
}
