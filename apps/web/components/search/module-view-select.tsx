"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, Loader2, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteCustomModuleView,
  listCustomModuleViews,
  setCustomModuleViewDefault,
  updateCustomModuleView,
} from "@/app/search/views/actions";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CustomModuleView } from "@/lib/search/types";
import {
  getAllViewLabel,
  getModuleViewDefinition,
  isSavedViewsScope,
} from "@/lib/search/views/module-view-registry";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  triggerClassName?: string;
};

function snapshotToView(
  snapshot: NonNullable<ReturnType<typeof useOptionalOmnibarContext>>["activeSavedView"]
): CustomModuleView | null {
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    tenant_id: "",
    user_id: "",
    module_name: snapshot.module_name,
    view_name: snapshot.view_name,
    raw_search_text: snapshot.raw_search_text,
    compiled_ast: snapshot.compiled_ast,
    is_system_default: false,
    created_at: "",
    updated_at: "",
  };
}

type SavedViewRowProps = {
  view: CustomModuleView;
  isSelected: boolean;
  onSelect: (view: CustomModuleView) => void;
  onEditCriteria: (view: CustomModuleView) => void;
  onSetDefault: (view: CustomModuleView) => void;
  onRename: (view: CustomModuleView) => void;
  onDelete: (view: CustomModuleView) => void;
};

function SavedViewRow({
  view,
  isSelected,
  onSelect,
  onEditCriteria,
  onSetDefault,
  onRename,
  onDelete,
}: SavedViewRowProps) {
  return (
    <div className="flex w-full items-center rounded-sm hover:bg-accent focus-within:bg-accent">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm outline-none"
        onClick={() => onSelect(view)}
      >
        <Check
          className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
          aria-hidden
        />
        <span className="truncate">
          {view.is_system_default ? "★ " : ""}
          {view.view_name}
        </span>
      </button>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mr-0.5 h-7 w-7 shrink-0 p-0 text-muted-foreground hover:bg-background/80 hover:text-foreground"
            aria-label={`Manage ${view.view_name}`}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="right" className="w-44">
          <DropdownMenuItem onSelect={() => onEditCriteria(view)}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit criteria
          </DropdownMenuItem>
          {!view.is_system_default ? (
            <DropdownMenuItem onSelect={() => onSetDefault(view)}>
              <Star className="mr-2 h-3.5 w-3.5" />
              Set as default
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => onRename(view)}>Rename</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => onDelete(view)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ModuleViewSelect({ className, triggerClassName }: Props) {
  const omnibar = useOptionalOmnibarContext();
  const [views, setViews] = useState<CustomModuleView[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoading, startTransition] = useTransition();
  const [renameTarget, setRenameTarget] = useState<CustomModuleView | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const scope = omnibar?.scope;
  const moduleDef = scope ? getModuleViewDefinition(scope) : null;

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
  }, [moduleDef?.moduleName, omnibar?.savedViewsRevision]);

  const activeSavedViewId = omnibar?.activeSavedViewId;
  const activeSavedView = omnibar?.activeSavedView;
  const hasActiveFilters = omnibar?.hasActiveFilters ?? false;

  const activeView = useMemo(() => {
    const fromList = views.find((view) => view.id === activeSavedViewId);
    if (fromList) return fromList;
    if (activeSavedView?.id === activeSavedViewId && activeSavedView) {
      return snapshotToView(activeSavedView);
    }
    return null;
  }, [views, activeSavedViewId, activeSavedView]);

  if (!omnibar || !scope || !isSavedViewsScope(scope) || !moduleDef) {
    return null;
  }

  const {
    loadSavedView,
    loadSavedViewAndEdit,
    clearFilters,
    clearActiveSavedView,
    setActiveSavedViewSnapshot,
    notifySavedViewsChanged,
    isExecuting,
  } = omnibar;

  const allLabel = getAllViewLabel(scope);
  const viewMatchesFilters = activeSavedViewId != null && hasActiveFilters;
  const isAllSelected = !viewMatchesFilters;
  const isFilterLoading = isExecuting && hasActiveFilters;

  const displayLabel =
    viewMatchesFilters && activeView
      ? `${activeView.is_system_default ? "★ " : ""}${activeView.view_name}`
      : hasActiveFilters
        ? `${allLabel} (filtered)`
        : allLabel;

  const handleSelectAll = () => {
    clearFilters();
    setMenuOpen(false);
  };

  const handleSelectView = (view: CustomModuleView) => {
    loadSavedView(view);
    setMenuOpen(false);
  };

  const handleSetDefault = (view: CustomModuleView) => {
    startTransition(async () => {
      const result = await setCustomModuleViewDefault(view.id);
      if (!result.ok) {
        toast.error(result.error ?? "Unable to set default view.");
        return;
      }
      refreshViews();
      notifySavedViewsChanged();
      toast.success(`"${view.view_name}" is now the default view.`);
    });
  };

  const handleDelete = (view: CustomModuleView) => {
    startTransition(async () => {
      const result = await deleteCustomModuleView(view.id);
      if (!result.ok) {
        toast.error(result.error ?? "Unable to delete view.");
        return;
      }
      if (activeSavedViewId === view.id) {
        clearActiveSavedView();
        clearFilters();
      }
      refreshViews();
      notifySavedViewsChanged();
      toast.success("View deleted.");
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

  const handleEditCriteria = (view: CustomModuleView) => {
    setMenuOpen(false);
    if (view.id === activeSavedViewId) {
      omnibar.editActiveViewCriteria();
      return;
    }
    loadSavedViewAndEdit(view);
  };

  const openRename = (view: CustomModuleView) => {
    setRenameTarget(view);
    setRenameValue(view.view_name);
    setMenuOpen(false);
  };

  return (
    <div className={className}>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            aria-busy={isFilterLoading}
            className={cn(
              "h-8 justify-between gap-2 px-3 font-normal shadow-sm [&>span]:truncate",
              triggerClassName ?? "w-[9.5rem]"
            )}
            aria-label={isFilterLoading ? "Loading saved view filters" : "Saved filter view"}
          >
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              {isFilterLoading ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
              ) : null}
              <span className="truncate">{displayLabel}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="min-w-[12rem] p-1">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
            onClick={handleSelectAll}
          >
            <Check
              className={cn("h-4 w-4 shrink-0", isAllSelected ? "opacity-100" : "opacity-0")}
              aria-hidden
            />
            {allLabel}
          </button>

          {views.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No saved views yet</p>
          ) : (
            views.map((view) => (
              <SavedViewRow
                key={view.id}
                view={view}
                isSelected={view.id === activeSavedViewId && viewMatchesFilters}
                onSelect={handleSelectView}
                onEditCriteria={handleEditCriteria}
                onSetDefault={handleSetDefault}
                onRename={openRename}
                onDelete={handleDelete}
              />
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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
    </div>
  );
}
