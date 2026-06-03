"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveSystemCategory } from "@/app/items/categories/actions";
import {
  finalizeAttributeTemplateRows,
  isDuplicateAttributeKey,
  normalizeAttributeKey,
} from "@/lib/categories/attribute-key";
import type { CategoryEditorStageId } from "@/lib/categories/category-editor-stages";
import type { AttributeTemplateEntry, CategoryRow } from "@/lib/categories/types";
import { parentSelectOptions, resolveInheritedAttributeTemplates } from "@/lib/categories/tree";
import { validateAttributeTemplates } from "@/lib/categories/validate-templates";
import type { ProductVariantStrategy } from "@/lib/products/variant-strategy";

export type CategoryFormState = {
  name: string;
  parent_id: string | null;
  is_active: boolean;
  attribute_templates: AttributeTemplateEntry[];
  inherit_parent_attributes: boolean;
  default_variant_strategy: ProductVariantStrategy;
};

export const defaultCategoryFormState: CategoryFormState = {
  name: "",
  parent_id: null,
  is_active: true,
  attribute_templates: [],
  inherit_parent_attributes: true,
  default_variant_strategy: "SINGLE_SKU",
};

function formFromCategory(category: CategoryRow): CategoryFormState {
  return {
    name: category.name,
    parent_id: category.parent_id,
    is_active: category.is_active,
    attribute_templates: category.attribute_templates.map((entry) => ({ ...entry })),
    inherit_parent_attributes: category.inherit_parent_attributes,
    default_variant_strategy: category.default_variant_strategy,
  };
}

export function validateCategoryAttributeTemplates(form: CategoryFormState): string | null {
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

export function validateCategoryFormState(form: CategoryFormState): string | null {
  const trimmedName = form.name.trim();
  if (!trimmedName) return "Category name is required.";
  return validateCategoryAttributeTemplates(form);
}

export function validateCategoryStage(
  stage: CategoryEditorStageId,
  form: CategoryFormState
): string | null {
  if (stage === "basics") {
    if (!form.name.trim()) return "Category name is required.";
    return null;
  }
  if (stage === "attributes") {
    if (!form.name.trim()) return "Category name is required.";
    return validateCategoryAttributeTemplates(form);
  }
  if (stage === "defaults") {
    return validateCategoryFormState(form);
  }
  return null;
}

export type UseCategoryFormOptions = {
  rows: CategoryRow[];
  editingCategory?: CategoryRow | null;
  onSaved: (categoryId: string) => void;
  notifyOnSave?: boolean;
};

export function useCategoryForm({
  rows,
  editingCategory = null,
  onSaved,
  notifyOnSave = true,
}: UseCategoryFormOptions) {
  const router = useRouter();
  const isEditing = Boolean(editingCategory);
  const [form, setForm] = useState<CategoryFormState>(defaultCategoryFormState);
  const [baseline, setBaseline] = useState<CategoryFormState>(defaultCategoryFormState);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parentOptions = parentSelectOptions(rows, editingCategory?.id ?? null);

  const inheritedPreview = useMemo(() => {
    if (!form.parent_id || !form.inherit_parent_attributes) return [];
    const previewCategoryId = editingCategory?.id ?? "draft-preview";
    const previewRows: CategoryRow[] = editingCategory
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
            default_variant_strategy: form.default_variant_strategy,
            created_at: "",
            updated_at: "",
          },
        ];
    return resolveInheritedAttributeTemplates(previewCategoryId, previewRows);
  }, [editingCategory, form, rows]);

  const resetFromEditing = useCallback(() => {
    if (editingCategory) {
      const next = formFromCategory(editingCategory);
      setForm(next);
      setBaseline(next);
    } else {
      setForm(defaultCategoryFormState);
      setBaseline(defaultCategoryFormState);
    }
    setError(null);
  }, [editingCategory]);

  useEffect(() => {
    resetFromEditing();
  }, [resetFromEditing]);

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);

  const submit = useCallback(() => {
    setError(null);
    const validationError = validateCategoryFormState(form);
    if (validationError) {
      setError(validationError);
      if (notifyOnSave) toast.error(validationError);
      return;
    }

    startTransition(async () => {
      const templates = finalizeAttributeTemplateRows(form.attribute_templates);

      const result = await saveSystemCategory({
        category_id: editingCategory?.id ?? null,
        name: form.name.trim(),
        parent_id: form.parent_id,
        is_active: form.is_active,
        attribute_templates: templates,
        inherit_parent_attributes: form.parent_id ? form.inherit_parent_attributes : true,
        default_variant_strategy: form.default_variant_strategy,
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
      router.refresh();
      onSaved(result.categoryId);
    });
  }, [editingCategory?.id, form, isEditing, notifyOnSave, onSaved, router]);

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
    validateStage: (stage: CategoryEditorStageId) => validateCategoryStage(stage, form),
  };
}
