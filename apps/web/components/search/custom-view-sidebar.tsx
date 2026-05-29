"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteCustomModuleView,
  listCustomModuleViews,
  saveCustomModuleView,
  updateCustomModuleView,
} from "@/app/search/views/actions";
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
import { cn } from "@/lib/utils";
import { Bookmark, ChevronDown, ChevronRight, MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onViewSelect?: () => void;
};

export function CustomViewSidebar({
  className,
  collapsed = false,
  onCollapsedChange,
  onViewSelect,
}: Props) {
  const {
    scope,
    loadSavedView,
    activeSavedViewId,
    setActiveSavedViewSnapshot,
    clearActiveSavedView,
    savedViewsRevision,
    notifySavedViewsChanged,
  } = useOmnibarContext();

  const moduleDef = getModuleViewDefinition(scope);
  const [views, setViews] = useState<CustomModuleView[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [renameTarget, setRenameTarget] = useState<CustomModuleView | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const refreshViews = () => {
    if (!moduleDef) return;
    startTransition(async () => {
      const result = await listCustomModuleViews(moduleDef.moduleName);
      if (!result.ok) {
        toast.error(result.error ?? "Unable to load saved views.");
        return;
      }
      setViews(result.views ?? []);
    });
  };

  useEffect(() => {
    refreshViews();
  }, [scope, moduleDef?.moduleName, savedViewsRevision]);

  if (!moduleDef) return null;

  const handleDelete = (view: CustomModuleView) => {
    startTransition(async () => {
      const result = await deleteCustomModuleView(view.id);
      if (!result.ok) {
        toast.error(result.error ?? "Unable to delete view.");
        return;
      }
      if (activeSavedViewId === view.id) {
        clearActiveSavedView();
      }
      refreshViews();
      notifySavedViewsChanged();
      toast.success("Saved view deleted.");
    });
  };

  const handleRename = () => {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;

    startTransition(async () => {
      const result = await updateCustomModuleView({ id: renameTarget.id, viewName: trimmed });
      if (!result.ok) {
        toast.error(result.error ?? "Unable to rename view.");
        return;
      }
      if (result.view && activeSavedViewId === renameTarget.id) {
        setActiveSavedViewSnapshot({
          id: result.view.id,
          module_name: result.view.module_name,
          view_name: result.view.view_name,
          raw_search_text: result.view.raw_search_text,
          compiled_ast: result.view.compiled_ast,
        });
      }
      setRenameTarget(null);
      setRenameValue("");
      refreshViews();
      notifySavedViewsChanged();
      toast.success("View renamed.");
    });
  };

  return (
    <>
      <aside
        className={cn(
          "flex shrink-0 flex-col border-border/80 bg-card/30",
          collapsed ? "w-10" : "w-52 border-r pr-2",
          className
        )}
        aria-label="Saved views sidebar"
      >
        <div className="flex items-center justify-between gap-1 px-2 py-2">
          {!collapsed ? (
            <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Bookmark className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{moduleDef.label}</span>
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 shrink-0 p-0"
            onClick={() => onCollapsedChange?.(!collapsed)}
            aria-label={collapsed ? "Expand saved views" : "Collapse saved views"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </div>

        {!collapsed ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
            {isLoading && views.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">Loading views…</p>
            ) : views.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                Save filters from the chip bar to build reusable views.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {views.map((view) => {
                  const active = activeSavedViewId === view.id;
                  return (
                    <li key={view.id} className="group flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          loadSavedView(view);
                          onViewSelect?.();
                        }}
                        className={cn(
                          "min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-200 hover:bg-accent/60",
                          active && "bg-primary/10 font-medium text-primary"
                        )}
                        title={view.view_name}
                      >
                        {view.view_name}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 shrink-0 p-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                            aria-label={`Actions for ${view.view_name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => {
                              setRenameTarget(view);
                              setRenameValue(view.view_name);
                            }}
                          >
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(view)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </aside>

      <Sheet open={renameTarget != null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <SheetContent side="right" className="w-full max-w-sm">
          <SheetHeader>
            <SheetTitle>Rename view</SheetTitle>
            <SheetDescription>Choose a new name for this saved filter view.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <Input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder="View name"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRenameTarget(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleRename} disabled={!renameValue.trim()}>
                Save
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

type SaveViewSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  onSaved?: (view: CustomModuleView) => void;
};

export function SaveViewSheet({ open, onOpenChange, defaultName = "", onSaved }: SaveViewSheetProps) {
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

      if (!result.ok || !result.view) {
        toast.error(result.error ?? "Unable to save view.");
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
          <p className="text-xs text-muted-foreground line-clamp-3">{appliedQuery}</p>
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
