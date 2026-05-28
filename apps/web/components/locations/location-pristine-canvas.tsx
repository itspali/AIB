"use client";

import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  canProvision: boolean;
  onProvision: () => void;
};

export function LocationPristineCanvas({ canProvision, onProvision }: Props) {
  return (
    <div className="flex h-full min-h-[520px] flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/60">
        <Building2 className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold">Facility Command Canvas</h2>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        Select a facility profile from the reporting directory tree to inspect logistics metadata, or
        provision a new node.
      </p>
      {canProvision && (
        <Button className="mt-6" onClick={onProvision}>
          <Plus className="h-4 w-4" />
          Provision First Facility Location
        </Button>
      )}
    </div>
  );
}
