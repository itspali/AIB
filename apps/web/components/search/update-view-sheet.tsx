"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateCustomModuleView } from "@/app/search/views/actions";
import { FilterChipRow } from "@/components/search/filter-chip-row";
import { useOmnibarContext } from "@/components/search/omnibar-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { extractStructuralAst } from "@/lib/search/views/saved-view-utils";

type UpdateViewSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

export function UpdateViewSheet({ open, onOpenChange, onUpdated }: UpdateViewSheetProps) {
  const {
    activeSavedView,
    appliedQuery,
    activeAst,
    setActiveSavedViewSnapshot,
    notifySavedViewsChanged,
    openCommandPalette,
  } = useOmnibarContext();
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    if (!activeSavedView) return;
    const trimmedQuery = appliedQuery.trim();
    if (!trimmedQuery) return;

    startTransition(async () => {
      const result = await updateCustomModuleView({
        id: activeSavedView.id,
        rawSearchText: trimmedQuery,
        compiledAst: extractStructuralAst(activeAst),
      });

      if (!result.ok) {
        toast.error(result.error ?? "Unable to update view.");
        return;
      }
      if (!result.view) {
        toast.error("Unable to update view.");
        return;
      }

      setActiveSavedViewSnapshot({
        id: result.view.id,
        module_name: result.view.module_name,
        view_name: result.view.view_name,
        raw_search_text: result.view.raw_search_text,
        compiled_ast: result.view.compiled_ast,
      });
      onUpdated?.();
      notifySavedViewsChanged();
      onOpenChange(false);
      toast.success("View updated.");
    });
  };

  if (!activeSavedView) return null;

  const chips = activeAst.filter((clause) => clause.kind !== "text");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm">
        <SheetHeader>
          <SheetTitle>Save changes to view</SheetTitle>
          <SheetDescription>
            Persist the updated filter criteria to &ldquo;{activeSavedView.view_name}&rdquo;.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Filter query
            </p>
            <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              {appliedQuery.trim() || "No filters applied"}
            </p>
          </div>

          {chips.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Criteria ({chips.length})
              </p>
              <FilterChipRow ast={activeAst} className="pointer-events-none" />
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                openCommandPalette();
              }}
            >
              Edit criteria
            </Button>
            <Button type="button" onClick={handleSave} disabled={isPending || !appliedQuery.trim()}>
              Save changes
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
