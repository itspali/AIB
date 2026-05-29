"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveCustomModuleView } from "@/app/search/views/actions";
import { useOmnibarContext } from "@/components/search/omnibar-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getModuleViewDefinition } from "@/lib/search/views/module-view-registry";
import { extractStructuralAst } from "@/lib/search/views/saved-view-utils";
import type { CustomModuleView } from "@/lib/search/types";

type SaveViewSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  onSaved?: (view: CustomModuleView) => void;
};

export function SaveViewSheet({
  open,
  onOpenChange,
  defaultName = "",
  onSaved,
}: SaveViewSheetProps) {
  const { scope, appliedQuery, activeAst, setActiveSavedViewSnapshot, notifySavedViewsChanged } =
    useOmnibarContext();
  const moduleDef = getModuleViewDefinition(scope);
  const [viewName, setViewName] = useState(defaultName);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) setViewName(defaultName);
  }, [open, defaultName]);

  const handleSave = () => {
    if (!moduleDef) return;
    const trimmedName = viewName.trim();
    if (!trimmedName || !appliedQuery.trim()) return;

    startTransition(async () => {
      const result = await saveCustomModuleView({
        moduleName: moduleDef.moduleName,
        viewName: trimmedName,
        rawSearchText: appliedQuery.trim(),
        compiledAst: extractStructuralAst(activeAst),
      });

      if (!result.ok) {
        toast.error(result.error ?? "Unable to save view.");
        return;
      }
      if (!result.view) {
        toast.error("Unable to save view.");
        return;
      }

      setActiveSavedViewSnapshot({
        id: result.view.id,
        module_name: result.view.module_name,
        view_name: result.view.view_name,
        raw_search_text: result.view.raw_search_text,
        compiled_ast: result.view.compiled_ast,
      });
      onSaved?.(result.view);
      notifySavedViewsChanged();
      onOpenChange(false);
      toast.success("View saved.");
    });
  };

  if (!moduleDef) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm">
        <SheetHeader>
          <SheetTitle>Save view</SheetTitle>
          <SheetDescription>
            Store the current native filter as a reusable view for this module.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <Input
            value={viewName}
            onChange={(event) => setViewName(event.target.value)}
            placeholder="e.g. May High Margin Items"
            autoFocus
          />
          <p className="line-clamp-3 text-xs text-muted-foreground">{appliedQuery}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isPending || !viewName.trim() || !appliedQuery.trim()}
            >
              Save view
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
