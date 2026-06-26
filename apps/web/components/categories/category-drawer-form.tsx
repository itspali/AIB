"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  CategoryEditorShell,
  CATEGORY_SECTION_ATTRIBUTES_ID,
  CATEGORY_SECTION_BASICS_ID,
} from "@/components/categories/category-editor-shell";
import type { QcTestTemplateScopePanelHandle } from "@/components/procurement/quality-inspection/qc-test-template-scope-panel";
import { RightDrawer } from "@/components/ui/right-drawer";
import { Button } from "@/components/ui/button";
import type { CategoryRow } from "@/lib/categories/types";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import { useCategoryForm } from "@/lib/categories/use-category-form";
import { isMutationSurface, type DrawerSurface } from "@/lib/layout/module-drawer-url";
import { toast } from "sonner";

type Props = {
  open: boolean;
  surface: DrawerSurface;
  rows: CategoryRow[];
  peekCategory: CategoryRow | null;
  onClose: () => void;
  onOpenEdit: (categoryId: string) => void;
  onAfterSave: (categoryId: string, category: CategoryRow) => void;
  onDelete?: (category: CategoryRow) => void;
};

function resolveDrawerTitle(surface: DrawerSurface, category: CategoryRow | null): string {
  if (surface === "create") return "New category";
  if (surface === "edit") return category ? `Edit ${category.name}` : "Edit category";
  return category?.name ?? "Category";
}

export function CategoryDrawerForm({
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
  const editingCategory =
    surface === "create" ? null : peekCategory;
  const qcTemplatePanelRef = useRef<QcTestTemplateScopePanelHandle>(null);
  const [qcTemplateDirty, setQcTemplateDirty] = useState(false);

  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating,
  });

  const formApi = useCategoryForm({
    rows,
    editingCategory,
    onSaved: async (category) => {
      onAfterSave(category.id, category);
      const qcResult = await qcTemplatePanelRef.current?.saveIfDirty();
      if (qcResult && !qcResult.ok) {
        toast.error(`Category saved, but inspection tests could not be saved: ${qcResult.error}`);
      }
    },
  });

  const { isPending, submit, resetFromEditing, isDirty } = formApi;
  const hasUnsavedChanges = isDirty || qcTemplateDirty;
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const chipBarRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [activeSection, setActiveSection] = useState(CATEGORY_SECTION_BASICS_ID);
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    if (open) {
      resetFromEditing();
      setActiveSection(CATEGORY_SECTION_BASICS_ID);
      setQcTemplateDirty(false);
    }
  }, [open, resetFromEditing, surface, peekCategory?.id]);

  const closeForm = useCallback(() => {
    resetFromEditing();
    setQcTemplateDirty(false);
    onClose();
  }, [onClose, resetFromEditing]);

  const handleRequestClose = useCallback(() => {
    if (isMutating && hasUnsavedChanges) {
      requestClose(closeForm);
      return;
    }
    closeForm();
  }, [closeForm, hasUnsavedChanges, isMutating, requestClose]);

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
        title={resolveDrawerTitle(surface, peekCategory)}
        widthPolicy={surface === "peek" ? "peek" : "mutate"}
        headerActions={headerActions}
        allowBackgroundInteraction={surface === "peek"}
        scrollable={false}
        bodyRef={bodyRef}
        showCloseButton
      >
        <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div ref={paneRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {showLoadingPeek ? (
              <p className="py-8 text-sm text-muted-foreground">Loading category…</p>
            ) : (
              <CategoryEditorShell
                formApi={formApi}
                editingCategoryId={editingCategory?.id ?? null}
                layout="drawer"
                readOnly={readOnly}
                activeSection={activeSection}
                onActiveSectionChange={setActiveSection}
                scrollRootRef={paneRef}
                chipBarRef={chipBarRef}
                qcTemplatePanelRef={qcTemplatePanelRef}
                onQcTemplateDirtyChange={setQcTemplateDirty}
              />
            )}
          </div>
        </div>
      </RightDrawer>
      {discardDialog}
    </>
  );
}
