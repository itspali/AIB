import type { CategoryEditorStageId } from "@/lib/categories/category-editor-stages";
import type { CategoryFormState } from "@/lib/categories/use-category-form";
import type { StageStatus } from "@/lib/products/item-completeness";

export function categoryStageStatuses(form: CategoryFormState): Record<CategoryEditorStageId, StageStatus> {
  const nameOk = form.name.trim().length > 0;
  const hasAttributes = form.attribute_templates.length > 0;
  const hasDefaults = form.attribute_templates.some(
    (template) => template.role === "axis" || template.role === "descriptive"
  );

  return {
    basics: nameOk ? "complete" : "empty",
    attributes: hasAttributes ? "complete" : "partial",
    defaults: hasDefaults ? "complete" : "partial",
  };
}

export function categoryWizardPercent(statuses: Record<CategoryEditorStageId, StageStatus>): number {
  const values = Object.values(statuses);
  const complete = values.filter((status) => status === "complete").length;
  return Math.round((complete / values.length) * 100);
}
