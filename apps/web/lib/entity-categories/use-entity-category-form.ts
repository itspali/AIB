"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveEntityCategory } from "@/app/entities/category-actions";
import {
  finalizeAttributeTemplateRows,
  isDuplicateAttributeKey,
  normalizeAttributeKey,
} from "@/lib/categories/attribute-key";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { validateAttributeTemplates } from "@/lib/categories/validate-templates";
import {
  entityCategoryParentSelectOptions,
  resolveInheritedEntityCategoryAttributeTemplates,
} from "@/lib/entity-categories/tree";
import type { EntityCategoryRow, EntityCategoryWorkspace } from "@/lib/entity-categories/types";

export type EntityCategoryFormState = {
  name: string;
  parent_id: string | null;
  is_active: boolean;
  attribute_templates: AttributeTemplateEntry[];
  inherit_parent_attributes: boolean;
};

export const defaultEntityCategoryFormState: EntityCategoryFormState = {
  name: "",
  parent_id: null,
  is_active: true,
  attribute_templates: [],
  inherit_parent_attributes: true,
};

function formFromCategory(category: EntityCategoryRow): EntityCategoryFormState {
  return {
    name: category.name,
    parent_id: category.parent_id,
    is_active: category.is_active,
    attribute_templates: category.attribute_templates.map((entry) => ({ ...entry })),
    inherit_parent_attributes: category.inherit_parent_attributes,
  };
}

export function validateEntityCategoryAttributeTemplates(
  form: EntityCategoryFormState
): string | null {
  const templates = finalizeAttributeTemplateRows(form.attribute_templates);

  for (let index = 0; index < templates.length; index += 1) {
    if (isDuplicateAttributeKey(templates, index)) {
      return "Duplicate attribute keys are not allowed.";
    }
  }

  const keys = new Set<string>();
  for (const entry of templates) {
    const key = normalizeAttributeKey(entry.key);
    if (!key) continue;
    if (keys.has(key)) {
      return "Duplicate attribute keys are not allowed.";
    }
    keys.add(key);
  }

  return validateAttributeTemplates(templates);
}

export function validateEntityCategoryFormState(form: EntityCategoryFormState): string | null {
  const trimmedName = form.name.trim();
  if (!trimmedName) return "Category name is required.";
  return validateEntityCategoryAttributeTemplates(form);
}

export type UseEntityCategoryFormOptions = {
  workspace: EntityCategoryWorkspace;
  rows: EntityCategoryRow[];
  editingCategory?: EntityCategoryRow | null;
  onSaved: (category: EntityCategoryRow) => void;
  notifyOnSave?: boolean;
};

export function useEntityCategoryForm({
  workspace,
  rows,
  editingCategory = null,
  onSaved,
  notifyOnSave = true,
}: UseEntityCategoryFormOptions) {
  const isEditing = Boolean(editingCategory);
  const [form, setForm] = useState<EntityCategoryFormState>(defaultEntityCategoryFormState);
  const [baseline, setBaseline] = useState<EntityCategoryFormState>(defaultEntityCategoryFormState);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parentOptions = entityCategoryParentSelectOptions(rows, editingCategory?.id ?? null);

  const inheritedPreview = useMemo(() => {
    if (!form.parent_id || !form.inherit_parent_attributes) return [];
    const previewCategoryId = editingCategory?.id ?? "draft-preview";
    const previewRows: EntityCategoryRow[] = editingCategory
      ? rows.map((row) =>
          row.id === editingCategory.id
            ? {
                ...row,
                parent_id: form.parent_id,
                inherit_parent_attributes: form.inherit_parent_attributes,
              }
            : row
        )
      : [
          ...rows,
          {
            id: previewCategoryId,
            name: form.name || "Draft",
            parent_id: form.parent_id,
            is_active: true,
            attribute_templates: [],
            inherit_parent_attributes: form.inherit_parent_attributes,
            created_at: "",
            updated_at: "",
          },
        ];
    return resolveInheritedEntityCategoryAttributeTemplates(previewCategoryId, previewRows);
  }, [editingCategory, form, rows]);

  const resetFromEditing = useCallback(() => {
    if (editingCategory) {
      const next = formFromCategory(editingCategory);
      setForm(next);
      setBaseline(next);
    } else {
      setForm(defaultEntityCategoryFormState);
      setBaseline(defaultEntityCategoryFormState);
    }
    setError(null);
  }, [editingCategory]);

  useEffect(() => {
    resetFromEditing();
  }, [resetFromEditing]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline]
  );

  const submit = useCallback(() => {
    setError(null);
    const validationError = validateEntityCategoryFormState(form);
    if (validationError) {
      setError(validationError);
      if (notifyOnSave) toast.error(validationError);
      return;
    }

    startTransition(async () => {
      const templates = finalizeAttributeTemplateRows(form.attribute_templates);

      const result = await saveEntityCategory(workspace, {
        category_id: editingCategory?.id ?? null,
        name: form.name.trim(),
        parent_id: form.parent_id,
        is_active: form.is_active,
        attribute_templates: templates,
        inherit_parent_attributes: form.parent_id ? form.inherit_parent_attributes : true,
      });

      if ("error" in result) {
        const message = result.error ?? "Unable to save category.";
        setError(message);
        if (notifyOnSave) toast.error(message);
        return;
      }

      if (notifyOnSave) {
        toast.success(
          isEditing ? "Category updated successfully" : "Category created successfully"
        );
      }
      setBaseline(form);
      onSaved(result.category);
    });
  }, [editingCategory?.id, form, isEditing, notifyOnSave, onSaved, workspace]);

  return {
    form,
    setForm,
    baseline,
    error,
    setError,
    isPending,
    isEditing,
    isDirty,
    parentOptions,
    inheritedPreview,
    resetFromEditing,
    submit,
  };
}
