import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onCreate?: () => void;
  hasBillableOrders?: boolean;
  hasSuppliers?: boolean;
};

export function BillEmptyState({
  onCreate,
  hasBillableOrders = true,
  hasSuppliers = true,
}: Props) {
  const canCreate = hasBillableOrders && hasSuppliers;

  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 border-black/[0.06] bg-muted/35 px-6 py-12 text-center dark:border-white/10 dark:bg-muted/20">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
        <Receipt className="h-8 w-8 text-primary" aria-hidden />
      </div>
      <p className="max-w-md text-sm font-medium">No supplier bills yet.</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {canCreate
          ? "Record vendor invoices against purchase orders with received goods and run three-way matching."
          : !hasSuppliers
            ? "Register at least one supplier entity before recording bills."
            : "Issue a purchase order and post a goods receipt before creating your first bill."}
      </p>
      {onCreate && canCreate ? (
        <Button className="mt-6 shadow-glow-sm" onClick={onCreate}>
          New bill
        </Button>
      ) : null}
    </div>
  );
}
