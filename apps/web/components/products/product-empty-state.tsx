"use client";

import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onCreate: () => void;
  hasExistingProducts?: boolean;
};

export function ProductEmptyState({ onCreate, hasExistingProducts = false }: Props) {
  return (
    <div className="surface-inset flex min-h-[360px] flex-col items-center justify-center border-dashed px-6 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
        <Package className="h-8 w-8 text-primary" aria-hidden />
      </div>
      <p className="max-w-md text-sm font-medium">
        Select an item profile from the directory stream to review data fields, or initialize a
        new record.
      </p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {hasExistingProducts
          ? "Choose a product from the left panel or create a new master profile."
          : "Start by defining your first product master profile to unblock catalog operations."}
      </p>
      <Button className="mt-6 shadow-glow-sm" onClick={onCreate}>
        {hasExistingProducts ? "Create New Item Profile" : "Create New Item Profile"}
      </Button>
    </div>
  );
}
