export type CategoryEditorStageId = "basics" | "attributes" | "defaults";

export type CategoryEditorStage = {
  id: CategoryEditorStageId;
  label: string;
  description: string;
};

export const CATEGORY_EDITOR_STAGES: CategoryEditorStage[] = [
  {
    id: "basics",
    label: "Basics",
    description: "Name, parent, and whether the category is active.",
  },
  {
    id: "attributes",
    label: "Attributes",
    description: "Fields items in this category can capture beyond inherited ones.",
  },
  {
    id: "defaults",
    label: "Defaults",
    description: "Per-attribute version-axis hints for new items.",
  },
];

export const CATEGORY_EDITOR_STAGE_IDS: CategoryEditorStageId[] = CATEGORY_EDITOR_STAGES.map(
  (stage) => stage.id
);

export function isCategoryEditorStageId(
  value: string | null | undefined
): value is CategoryEditorStageId {
  return value === "basics" || value === "attributes" || value === "defaults";
}

export function categoryEditorStageById(id: CategoryEditorStageId): CategoryEditorStage {
  const stage = CATEGORY_EDITOR_STAGES.find((entry) => entry.id === id);
  if (!stage) throw new Error(`Unknown category editor stage: ${id}`);
  return stage;
}
