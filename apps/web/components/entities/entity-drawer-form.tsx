"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  EntityEditorShell,
  ENTITY_SECTION_ESSENTIALS_ID,
} from "@/components/entities/entity-editor-shell";
import { RightDrawer } from "@/components/ui/right-drawer";
import { Button } from "@/components/ui/button";
import type { EntityDetailSnapshot, EntityWorkspace } from "@/lib/entities/types";
import type { EntityCustomFieldDefinition } from "@/lib/entities/custom-field-definitions";
import { getEntityWorkspaceConfig } from "@/lib/entities/workspace-config";
import { useEntityForm } from "@/lib/entities/use-entity-form";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import { isMutationSurface, type DrawerSurface } from "@/lib/layout/module-drawer-url";
import { saveEntity } from "@/app/entities/actions";

type Props = {
  workspace: EntityWorkspace;
  tenantId: string;
  customFieldDefinitions: EntityCustomFieldDefinition[];
  open: boolean;
  surface: DrawerSurface;
  editingEntity: EntityDetailSnapshot | null;
  onClose: () => void;
  onOpenEdit: (entityId: string) => void;
  onAfterSave: (entityId: string, entity: EntityDetailSnapshot) => void;
  onDelete?: (entity: EntityDetailSnapshot) => void;
  isLoading?: boolean;
};

function resolveDrawerTitle(
  workspace: EntityWorkspace,
  surface: DrawerSurface,
  entity: EntityDetailSnapshot | null
): string {
  const config = getEntityWorkspaceConfig(workspace);
  if (surface === "create") return config.createLabel;
  if (surface === "edit") {
    return entity ? `Edit ${entity.name}` : `Edit ${config.singularLabel.toLowerCase()}`;
  }
  return entity?.name ?? config.singularLabel;
}

export function EntityDrawerForm({
  workspace,
  tenantId,
  customFieldDefinitions,
  open,
  surface,
  editingEntity,
  onClose,
  onOpenEdit,
  onAfterSave,
  onDelete,
  isLoading = false,
}: Props) {
  const config = getEntityWorkspaceConfig(workspace);
  const readOnly = surface === "peek";
  const isMutating = isMutationSurface(surface);

  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating,
  });

  const formApi = useEntityForm({
    workspace,
    editingEntity: isMutating || readOnly ? editingEntity : editingEntity,
    logoPreviewUrl: editingEntity?.logo_preview_url ?? null,
    customFieldDefinitions,
    onSaved: (entity) => {
      onAfterSave(entity.id, entity);
    },
    onPersist: (payload) => saveEntity(workspace, payload),
  });

  const { isPending, submit, resetFromEditing, isDirty } = formApi;
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const chipBarRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [activeSection, setActiveSection] = useState(ENTITY_SECTION_ESSENTIALS_ID);
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    if (open) {
      resetFromEditing();
      setActiveSection(ENTITY_SECTION_ESSENTIALS_ID);
    }
  }, [open, resetFromEditing, surface, editingEntity?.id]);

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
      : config.createLabel;

  const headerActions =
    surface === "peek" && editingEntity ? (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0"
          onClick={() => onOpenEdit(editingEntity.id)}
          aria-label={`Edit ${config.singularLabel.toLowerCase()}`}
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
            onClick={() => onDelete(editingEntity)}
            aria-label={`Delete ${config.singularLabel.toLowerCase()}`}
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

  const showLoadingBody =
    isLoading || ((surface === "peek" || surface === "edit") && !editingEntity);

  return (
    <>
      <RightDrawer
        open={open}
        onOpenChange={(next) => {
          if (next) return;
          handleRequestClose();
        }}
        onRequestClose={handleRequestClose}
        title={resolveDrawerTitle(workspace, surface, editingEntity)}
        headerActions={headerActions}
        allowBackgroundInteraction={surface === "peek"}
        scrollable={false}
        bodyRef={bodyRef}
        showCloseButton
      >
        <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div ref={paneRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {showLoadingBody ? (
              <p className="py-8 text-sm text-muted-foreground">
                Loading {config.singularLabel.toLowerCase()}…
              </p>
            ) : (
              <EntityEditorShell
                workspace={workspace}
                tenantId={tenantId}
                formApi={formApi}
                customFieldDefinitions={customFieldDefinitions}
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
