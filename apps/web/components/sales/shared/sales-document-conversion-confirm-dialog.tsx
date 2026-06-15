"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type SalesDocumentConversionKind = "quote_to_order" | "quote_to_invoice" | "order_to_invoice";

const CONVERSION_COPY: Record<
  SalesDocumentConversionKind,
  { title: string; description: string; confirmLabel: string }
> = {
  quote_to_order: {
    title: "Convert to sales order?",
    description:
      "This will create a sales order from the quotation and mark the quote as converted.",
    confirmLabel: "Convert to order",
  },
  quote_to_invoice: {
    title: "Convert to invoice?",
    description:
      "This will create an invoice from the quotation and mark the quote as converted.",
    confirmLabel: "Convert to invoice",
  },
  order_to_invoice: {
    title: "Create invoice from order?",
    description:
      "This will create an invoice from the open lines on this sales order.",
    confirmLabel: "Create invoice",
  },
};

type Props = {
  kind: SalesDocumentConversionKind | null;
  open: boolean;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function SalesDocumentConversionConfirmDialog({
  kind,
  open,
  isPending = false,
  onOpenChange,
  onConfirm,
}: Props) {
  const copy = kind ? CONVERSION_COPY[kind] : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy?.title ?? "Convert document?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {copy?.description ?? "This action cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={onConfirm}>
            {isPending ? "Converting…" : (copy?.confirmLabel ?? "Confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
