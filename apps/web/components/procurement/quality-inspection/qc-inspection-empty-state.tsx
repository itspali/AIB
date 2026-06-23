"use client";

import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { PROCUREMENT_GRN_HREF } from "@/lib/procurement/navigation";

export function QcInspectionEmptyState() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 border-black/[0.06] bg-muted/35 px-6 py-12 text-center dark:border-white/10 dark:bg-muted/20">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
        <ClipboardCheck className="h-8 w-8 text-primary" aria-hidden />
      </div>
      <p className="max-w-md text-sm font-medium">No lines are awaiting quality inspection.</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        When goods receipts route stock through QC hold, lines appear here for pass/fail inspection
        before posting to sellable inventory.
      </p>
      <Link
        href={PROCUREMENT_GRN_HREF}
        className="mt-6 text-sm font-medium text-primary underline-offset-2 hover:underline"
      >
        View goods receipts
      </Link>
    </div>
  );
}
