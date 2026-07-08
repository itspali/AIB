import type { EditorSectionId } from "@/lib/products/editor-sections";

export { ItemVariantsStage, type ItemVariantsStageModel } from "./item-variants-stage";

/** SKUs section now lives under Essentials; kept for section id references. */
export const VARIANTS_SECTIONS: EditorSectionId[] = ["variants"];
