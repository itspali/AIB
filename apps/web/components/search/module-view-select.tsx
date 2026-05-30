"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Loader2, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  clearCustomModuleViewDefault,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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

function DefaultStarButton({
  isDefault,
  label,
  onSetDefault,
}: {
  isDefault: boolean;
  label: string;
  onSetDefault: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-8 w-7 shrink-0 p-0",
        isDefault ? "text-amber-500 hover:text-amber-500" : "text-muted-foreground hover:text-foreground"
      )}
      aria-label={isDefault ? `${label} is the default view` : `Set ${label} as default`}
      title={isDefault ? "Default view" : "Set as default"}
      onClick={(event) => {
        event.stopPropagation();
        if (!isDefault) {
          onSetDefault();
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Star className={cn("h-3.5 w-3.5", isDefault && "fill-current")} aria-hidden />
    </Button>
  );
}

type AllViewRowProps = {
  label: string;
  isSelected: boolean;
  isDefault: boolean;
  onSelect: () => void;
  onSetDefault: () => void;
};

function AllViewRow({ label, isSelected, isDefault, onSelect, onSetDefault }: AllViewRowProps) {
  return (
    <div className="flex w-full items-center gap-0.5 rounded-sm px-1 hover:bg-accent focus-within:bg-accent">
      <button
        type="button"
        className="flex h-8 w-7 shrink-0 items-center justify-center rounded-sm outline-none hover:bg-accent/80"
        onClick={onSelect}
        aria-label={`Select ${label}`}
      >
        <Check
          className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
          aria-hidden
        />
      </button>

      <DefaultStarButton isDefault={isDefault} label={label} onSetDefault={onSetDefault} />

      <button
        type="button"
        className="min-w-0 flex-1 truncate px-1 py-1.5 text-left text-sm outline-none"
        title={label}
        onClick={onSelect}
      >
        {label}
      </button>
    </div>
  );
}

type SavedViewRowProps = {
  view: CustomModuleView;
  isSelected: boolean;
  onSelect: (view: CustomModuleView) => void;
  onSetDefault: (view: CustomModuleView) => void;
  onRename: (view: CustomModuleView, nextName: string) => void;
  onDelete: (view: CustomModuleView) => void;
};

function SavedViewRow({
  view,
  isSelected,
  onSelect,
  onSetDefault,
  onRename,
  onDelete,
}: SavedViewRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(view.view_name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(view.view_name);
    }
  }, [isEditing, view.view_name]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditValue(view.view_name);
      setIsEditing(false);
      return;
    }
    if (trimmed !== view.view_name) {
      onRename(view, trimmed);
    }
    setIsEditing(false);
  };

  const cancelRename = () => {
    setEditValue(view.view_name);
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        "flex w-full items-center gap-0.5 rounded-sm px-1 hover:bg-accent focus-within:bg-accent",
        confirmDelete && "bg-destructive/5"
      )}
    >
      <button
        type="button"
        className="flex h-8 w-7 shrink-0 items-center justify-center rounded-sm outline-none hover:bg-accent/80"
        onClick={() => onSelect(view)}
        aria-label={`Select ${view.view_name}`}
      >
        <Check
          className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
          aria-hidden
        />
      </button>

      <DefaultStarButton
        isDefault={view.is_system_default}
        label={view.view_name}
        onSetDefault={() => onSetDefault(view)}
      />

      {isEditing ? (
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(event) => setEditValue(event.target.value)}
          className="h-7 min-w-0 flex-1 px-2 py-0 text-sm"
          aria-label="View name"
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              commitRename();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancelRename();
            }
          }}
          onBlur={commitRename}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        />
      ) : (
        <button
          type="button"
          className="min-w-0 flex-1 truncate px-1 py-1.5 text-left text-sm outline-none"
          title={view.view_name}
          onClick={() => onSelect(view)}
        >
          {view.view_name}
        </button>
      )}

      {!confirmDelete && !isEditing ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
          aria-label={`Rename ${view.view_name}`}
          title="Rename view"
          onClick={(event) => {
            event.stopPropagation();
            setIsEditing(true);
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </Button>
      ) : null}

      {confirmDelete ? (
        <div className="flex shrink-0 items-center gap-0.5 pr-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              setConfirmDelete(false);
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              setConfirmDelete(false);
              onDelete(view);
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            Delete
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-7 shrink-0 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Delete ${view.view_name}`}
          title="Delete view"
          onClick={(event) => {
            event.stopPropagation();
            setConfirmDelete(true);
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </Button>
      )}
    </div>
  );
}

export function ModuleViewSelect({ className, triggerClassName }: Props) {
  const omnibar = useOptionalOmnibarContext();
  const [views, setViews] = useState<CustomModuleView[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [, startTransition] = useTransition();

  const scope = omnibar?.scope;
  const moduleDef = scope ? getModuleViewDefinition(scope) : null;

  const loadViews = useCallback(async () => {
    if (!moduleDef) return;
    const result = await listCustomModuleViews(moduleDef.moduleName);
    if (!result.ok) {
      toast.error(result.error ?? "Unable to load saved views.");
      return;
    }
    setViews(result.views ?? []);
    setIsInitialLoading(false);
  }, [moduleDef]);

  useEffect(() => {
    void loadViews();
  }, [loadViews, omnibar?.savedViewsRevision]);

  const patchDefaultLocally = useCallback((defaultViewId: string | null) => {
    setViews((previous) =>
      previous.map((view) => ({
        ...view,
        is_system_default: defaultViewId != null && view.id === defaultViewId,
      }))
    );
  }, []);

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
    clearFilters,
    clearActiveSavedView,
    setActiveSavedViewSnapshot,
    notifySavedViewsChanged,
    isExecuting,
    isDefaultViewBootstrapping,
    resolvingDefaultView,
  } = omnibar;

  const allLabel = getAllViewLabel(scope);
  const viewMatchesFilters = activeSavedViewId != null && hasActiveFilters;
  const isAllSelected = !viewMatchesFilters;
  const isAllDefault = !views.some((view) => view.is_system_default);
  const isFilterLoading = isExecuting && hasActiveFilters;
  const isResolvingCustomDefault = isDefaultViewBootstrapping && resolvingDefaultView != null;

  const displayLabel =
    viewMatchesFilters && activeView
      ? `${activeView.is_system_default ? "★ " : ""}${activeView.view_name}`
      : hasActiveFilters
        ? `${allLabel} (filtered)`
        : isResolvingCustomDefault
          ? `★ ${resolvingDefaultView.view_name}`
          : isAllDefault && !isDefaultViewBootstrapping
            ? `★ ${allLabel}`
            : allLabel;

  const handleSelectAll = () => {
    clearFilters();
    setMenuOpen(false);
  };

  const handleSetAllDefault = () => {
    const previousViews = views;
    patchDefaultLocally(null);

    void clearCustomModuleViewDefault(moduleDef.moduleName).then((result) => {
      if (!result.ok) {
        setViews(previousViews);
        toast.error(result.error ?? "Unable to set default view.");
        return;
      }
      toast.success(`"${allLabel}" is now the default view.`);
    });
  };

  const handleSelectView = (view: CustomModuleView) => {
    loadSavedView(view);
    setMenuOpen(false);
  };

  const handleSetDefault = (view: CustomModuleView) => {
    const previousViews = views;
    patchDefaultLocally(view.id);

    void setCustomModuleViewDefault(view.id, moduleDef.moduleName).then((result) => {
      if (!result.ok) {
        setViews(previousViews);
        toast.error(result.error ?? "Unable to set default view.");
        return;
      }
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
      notifySavedViewsChanged();
      toast.success("View deleted.");
    });
  };

  const handleRename = (view: CustomModuleView, nextName: string) => {
    startTransition(async () => {
      const result = await updateCustomModuleView({ id: view.id, viewName: nextName });
      if (!result.ok) {
        toast.error(result.error ?? "Unable to rename view.");
        return;
      }
      if (result.view && activeSavedViewId === view.id) {
        setActiveSavedViewSnapshot({
          id: result.view.id,
          module_name: result.view.module_name,
          view_name: result.view.view_name,
          raw_search_text: result.view.raw_search_text,
          compiled_ast: result.view.compiled_ast,
        });
      }
      notifySavedViewsChanged();
      toast.success("View renamed.");
    });
  };

  return (
    <div className={className}>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={isInitialLoading}
            aria-busy={isFilterLoading || isDefaultViewBootstrapping}
            className={cn(
              "h-8 justify-between gap-2 px-3 font-normal shadow-sm [&>span]:truncate",
              triggerClassName ?? "w-[9.5rem]"
            )}
            aria-label={isFilterLoading ? "Loading saved view filters" : "Saved filter view"}
          >
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              {isFilterLoading || isDefaultViewBootstrapping ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
              ) : null}
              <span className="truncate">{displayLabel}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="min-w-[16rem] p-1">
          <AllViewRow
            label={allLabel}
            isSelected={isAllSelected && !isResolvingCustomDefault}
            isDefault={isAllDefault && !isResolvingCustomDefault}
            onSelect={handleSelectAll}
            onSetDefault={handleSetAllDefault}
          />

          {views.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No saved views yet</p>
          ) : (
            views.map((view) => (
              <SavedViewRow
                key={view.id}
                view={view}
                isSelected={view.id === activeSavedViewId && viewMatchesFilters}
                onSelect={handleSelectView}
                onSetDefault={handleSetDefault}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
