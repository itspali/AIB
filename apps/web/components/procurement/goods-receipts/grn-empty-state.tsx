import { PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onCreate?: () => void;
  hasLocations?: boolean;
};

export function GrnEmptyState({ onCreate, hasLocations = true }: Props) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 border-black/[0.06] bg-muted/35 px-6 py-12 text-center dark:border-white/10 dark:bg-muted/20">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
        <PackageCheck className="h-8 w-8 text-primary" aria-hidden />
      </div>
      <p className="max-w-md text-sm font-medium">No goods receipts have been posted yet.</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {hasLocations
          ? "Post a receipt against an issued purchase order or receive stock directly at a location."
          : "Add an active stock-holding location under Settings → Locations before posting receipts."}
      </p>
      {onCreate && hasLocations ? (
        <Button className="mt-6 shadow-glow-sm" onClick={onCreate}>
          New goods receipt
        </Button>
      ) : null}
    </div>
  );
}
