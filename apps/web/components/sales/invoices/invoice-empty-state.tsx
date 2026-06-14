"use client";

import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onCreate?: () => void;
  hasCustomers?: boolean;
};

export function InvoiceEmptyState({ onCreate, hasCustomers = true }: Props) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/35 px-6 py-12 text-center dark:bg-muted/20">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
        <Receipt className="h-8 w-8 text-primary" aria-hidden />
      </div>
      <p className="max-w-md text-sm font-medium">No sales invoices yet.</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {hasCustomers
          ? "Issue customer invoices from sales orders or create them directly, then post to accounts receivable."
          : "Register at least one customer before creating invoices."}
      </p>
      {onCreate && hasCustomers ? (
        <Button className="mt-6 shadow-glow-sm" onClick={onCreate}>
          New invoice
        </Button>
      ) : null}
    </div>
  );
}
