import { Receipt, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  canEdit?: boolean;
  isLoadingDefaults?: boolean;
  onCreate?: () => void;
  onLoadDefaults?: () => void;
};

export function TaxEmptyState({
  canEdit = false,
  isLoadingDefaults = false,
  onCreate,
  onLoadDefaults,
}: Props) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 border-black/[0.06] bg-muted/35 px-6 py-12 text-center dark:border-white/10 dark:bg-muted/20">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
        <Receipt className="h-8 w-8 text-primary" aria-hidden />
      </div>
      <p className="max-w-md text-sm font-medium">No tax rules defined yet.</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Create flat rates (e.g. GST 18%) or value-based slabs (e.g. apparel 5% / 12%) once, then
        assign them to items.
      </p>
      {canEdit ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {onLoadDefaults ? (
            <Button variant="outline" disabled={isLoadingDefaults} onClick={onLoadDefaults}>
              <Sparkles className="h-4 w-4" />
              Load defaults for my country
            </Button>
          ) : null}
          {onCreate ? (
            <Button className="shadow-glow-sm" onClick={onCreate}>
              Create first tax rule
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
