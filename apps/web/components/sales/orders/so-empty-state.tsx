import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onCreate?: () => void;
  hasLocations?: boolean;
  hasCustomers?: boolean;
};

export function SoEmptyState({
  onCreate,
  hasLocations = true,
  hasCustomers = true,
}: Props) {
  const canCreate = hasLocations && hasCustomers;

  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 border-black/[0.06] bg-muted/35 px-6 py-12 text-center dark:border-white/10 dark:bg-muted/20">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
        <ClipboardList className="h-8 w-8 text-primary" aria-hidden />
      </div>
      <p className="max-w-md text-sm font-medium">No sales orders yet.</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {canCreate
          ? "Create a draft sales order, submit for approval when required, then confirm to start fulfilment."
          : !hasLocations
            ? "Add an active stock-holding location under Settings → Locations before raising sales orders."
            : "Register at least one customer entity before creating sales orders."}
      </p>
      {onCreate && canCreate ? (
        <Button className="mt-6 shadow-glow-sm" onClick={onCreate}>
          New sales order
        </Button>
      ) : null}
    </div>
  );
}
