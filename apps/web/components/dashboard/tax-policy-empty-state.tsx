import { FileText, Plus, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";

type TaxPolicyEmptyStateProps = {
  onAdd: () => void;
};

export function TaxPolicyEmptyState({ onAdd }: TaxPolicyEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-gradient-to-b from-muted/30 to-transparent px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
        <FileText className="h-7 w-7 text-primary" aria-hidden />
      </div>
      <p className="text-sm font-medium">No tax policy slabs registered yet</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Add statutory rate components with HSN/SAC tokens to drive compliance returns.
      </p>
      <Button className="mt-5 shadow-glow-sm" size="sm" onClick={onAdd}>
        <Plus className="h-4 w-4" />
        Add New Policy Slab Row
      </Button>
    </div>
  );
}

export { Scale as TaxPolicyIcon };
