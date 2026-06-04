import type { EditorSectionId } from "@/lib/products/editor-sections";

/**
 * The guided create flow is broken into three stages. Each stage owns a set of
 * the editor's existing sections, so the wizard is a presentation over the same
 * form rather than a parallel implementation.
 */
export type EditorStageId = "essentials" | "versions" | "reach";

export type EditorStage = {
  id: EditorStageId;
  /** Short label for the stepper. */
  label: string;
  /** One-line intent shown under the stage heading. */
  description: string;
  /** Editor sections rendered while this stage is active. */
  sections: EditorSectionId[];
};

export const EDITOR_STAGES: EditorStage[] = [
  {
    id: "essentials",
    label: "Essentials",
    description: "Name, classification, pricing, and stock. Saving creates the item.",
    sections: ["overview", "salable", "purchasable", "inventory"],
  },
  {
    id: "versions",
    label: "Variants",
    description: "Choose what varies, then add or generate sellable variants.",
    sections: ["variants"],
  },
  {
    id: "reach",
    label: "Catalog & reach",
    description: "Media, tags, custom fields, and where it sells.",
    sections: ["media", "catalog", "reach"],
  },
];

export const EDITOR_STAGE_IDS: EditorStageId[] = EDITOR_STAGES.map((stage) => stage.id);

export function editorStageById(id: EditorStageId): EditorStage {
  const stage = EDITOR_STAGES.find((entry) => entry.id === id);
  if (!stage) throw new Error(`Unknown editor stage: ${id}`);
  return stage;
}

export function isEditorStageId(value: string | null | undefined): value is EditorStageId {
  return value === "essentials" || value === "versions" || value === "reach";
}

/** The stage that owns a given section, or undefined if the section is unmapped. */
export function stageForSection(sectionId: EditorSectionId): EditorStageId | undefined {
  return EDITOR_STAGES.find((stage) => stage.sections.includes(sectionId))?.id;
}

/**
 * Stage order for a specific item. Single-SKU items have nothing to compose, so
 * the Variants stage is dropped from the guided sequence.
 */
export function editorStageOrder(isMultiSku: boolean): EditorStageId[] {
  return EDITOR_STAGE_IDS.filter((id) => id !== "versions" || isMultiSku);
}
