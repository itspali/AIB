import type { EditorSectionId } from "@/lib/products/editor-sections";

/**
 * The guided create flow is broken into stages. Each stage owns a set of
 * the editor's existing sections, so the wizard is a presentation over the same
 * form rather than a parallel implementation.
 */
export type EditorStageId = "essentials" | "versions" | "composition" | "reach";

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
    description: "Identity, SKU setup, units, and stock settings.",
    sections: [
      "overview",
      "variants",
      "composite_item",
      "alternate_uoms",
      "item_logistics",
    ],
  },
  {
    id: "versions",
    label: "Variants",
    description: "Pick option values and create sellable SKUs.",
    sections: ["variant_rows"],
  },
  {
    id: "composition",
    label: "Composition",
    description: "Define what is included when this item is sold as a set.",
    sections: ["composition"],
  },
  {
    id: "reach",
    label: "Catalog & reach",
    description: "Pricing, vendors, media, tags, custom fields, and where it sells.",
    sections: [
      "purchasable",
      "salable",
      "quality_inspection",
      "media",
      "product_attributes",
      "custom_fields",
      "tags",
      "visibility",
    ],
  },
];

export const EDITOR_STAGE_IDS: EditorStageId[] = EDITOR_STAGES.map((stage) => stage.id);

export function editorStageById(id: EditorStageId): EditorStage {
  const stage = EDITOR_STAGES.find((entry) => entry.id === id);
  if (!stage) throw new Error(`Unknown editor stage: ${id}`);
  return stage;
}

export function isEditorStageId(value: string | null | undefined): value is EditorStageId {
  return (
    value === "essentials" ||
    value === "versions" ||
    value === "composition" ||
    value === "reach"
  );
}

/** The stage that owns a given section, or undefined if the section is unmapped. */
export function stageForSection(sectionId: EditorSectionId): EditorStageId | undefined {
  return EDITOR_STAGES.find((stage) => stage.sections.includes(sectionId))?.id;
}

export type EditorStageOrderInput = {
  showVariantsWizardStage: boolean;
  hasComposition: boolean;
};

/**
 * Stage order for a specific item.
 * - Variants: when the item uses multi-SKU composition (axes or variant rows)
 * - Composition: when sold as a set (`is_bundle`)
 */
export function editorStageOrder(input: EditorStageOrderInput): EditorStageId[] {
  return EDITOR_STAGE_IDS.filter((id) => {
    if (id === "versions" && !input.showVariantsWizardStage) return false;
    if (id === "composition" && !input.hasComposition) return false;
    return true;
  });
}
