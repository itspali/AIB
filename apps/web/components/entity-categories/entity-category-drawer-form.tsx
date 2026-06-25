"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  EntityCategoryEditorShell,
  ENTITY_CATEGORY_SECTION_BASICS_ID,
} from "@/components/entity-categories/entity-category-editor-shell";
import { RightDrawer } from "@/components/ui/right-drawer";
import { useModuleDrawerPeekPresentation } from "@/lib/layout/use-module-drawer-peek-presentation";
import { Button } from "@/components/ui/button";
import { getEntityCategoryWorkspaceConfig } from "@/lib/entity-categories/config";
import type { EntityCategoryRow, EntityCategoryWorkspace } from "@/lib/entity-categories/types";
import { useEntityCategoryForm } from "@/lib/entity-categories/use-entity-category-form";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import { isMutationSurface, type DrawerSurface } from "@/lib/layout/module-drawer-url";

type Props = {
  workspace: EntityCategoryWorkspace;
  open: boolean;
  surface: DrawerSurface;
  rows: EntityCategoryRow[];
  peekCategory: EntityCategoryRow | null;
  onClose: () => void;
  onOpenEdit: (categoryId: string) => void;
  onAfterSave: (categoryId: string, category: EntityCategoryRow) => void;
  onDelete?: (category: EntityCategoryRow) => void;
};

function resolveDrawerTitle(
  workspace: EntityCategoryWorkspace,
  surface: DrawerSurface,
  category: EntityCategoryRow | null
): string {
  const { titleSingular } = getEntityCategoryWorkspaceConfig(workspace);
  if (surface === "create") return `New ${titleSingular.toLowerCase()}`;
  if (surface === "edit") return category ? `Edit ${category.name}` : `Edit ${titleSingular.toLowerCase()}`;
  return category?.name ?? titleSingular;
}

export function EntityCategoryDrawerForm({
  workspace,
  open,
  surface,
  rows,
  peekCategory,
  onClose,
  onOpenEdit,
  onAfterSave,
  onDelete,
}: Props) {
  const readOnly = surface === "peek";
  const isMutating = isMutationSurface(surface);
  const { peekShellClassName, peekBodyClassName } = useModuleDrawerPeekPresentation(
    surface === "peek"
  );
  const editingCategory = surface === "create" ? null : peekCategory;

  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating,
  });

  const formApi = useEntityCategoryForm({
    workspace,
    rows,
    editingCategory,
    onSaved: (category) => {
      onAfterSave(category.id, category);
    },
  });

  const { isPending, submit, resetFromEditing, isDirty } = formApi;
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const chipBarRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [activeSection, setActiveSection] = useState(ENTITY_CATEGORY_SECTION_BASICS_ID);
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    if (open) {
      resetFromEditing();
      setActiveSection(ENTITY_CATEGORY_SECTION_BASICS_ID);
    }
  }, [open, resetFromEditing, surface, peekCategory?.id]);

  const closeForm = useCallback(() => {
    resetFromEditing();
    onClose();
  }, [onClose, resetFromEditing]);

  const handleRequestClose = useCallback(() => {
    if (isMutating && isDirty) {
      requestClose(closeForm);
      return;
    }
    closeForm();
  }, [closeForm, isDirty, isMutating, requestClose]);

  useEffect(() => {
    if (!open || !isMutating) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void submitRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMutating, open]);

  const saveLabel = isPending
    ? "Saving..."
    : surface === "edit"
      ? "Save changes"
      : "Create category";

  const headerActions =
    surface === "peek" && peekCategory ? (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0"
          onClick={() => onOpenEdit(peekCategory.id)}
          aria-label="Edit category"
          title="Edit"
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 shrink-0 p-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(peekCategory)}
            aria-label="Delete category"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </>
    ) : isMutating ? (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => requestClose(closeForm)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={submit}
          title="Save (Ctrl+Enter)"
        >
          {saveLabel}
        </Button>
      </>
    ) : null;

  if (!open || surface === "closed") return discardDialog;

  const showLoadingPeek = (surface === "peek" || surface === "edit") && !peekCategory;

  return (
    <>
      <RightDrawer
        open={open}
        onOpenChange={(next) => {
          if (next) return;
          handleRequestClose();
        }}
        onRequestClose={handleRequestClose}
        title={resolveDrawerTitle(workspace, surface, peekCategory)}
        headerActions={headerActions}
        allowBackgroundInteraction={surface === "peek"}
        peekMode={surface === "peek"}
        className={peekShellClassName}
        bodyClassName={surface === "peek" ? peekBodyClassName : undefined}
        scrollable={false}
        bodyRef={bodyRef}
        showCloseButton
      >
        <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div ref={paneRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {showLoadingPeek ? (
              <p className="py-8 text-sm text-muted-foreground">Loading category…</p>
            ) : (
              <EntityCategoryEditorShell
                formApi={formApi}
                editingCategoryId={editingCategory?.id ?? null}
                readOnly={readOnly}
                activeSection={activeSection}
                onActiveSectionChange={setActiveSection}
                scrollRootRef={paneRef}
                chipBarRef={chipBarRef}
              />
            )}
          </div>
        </div>
      </RightDrawer>
      {discardDialog}
    </>
  );
}
