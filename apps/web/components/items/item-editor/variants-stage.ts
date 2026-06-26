import { editorStageById } from "@/lib/products/editor-stages";
import type { EditorSectionId } from "@/lib/products/editor-sections";

export { ItemVariantsStage, type ItemVariantsStageModel } from "./item-variants-stage";

export const VARIANTS_STAGE = editorStageById("versions");
export const VARIANTS_SECTIONS: EditorSectionId[] = VARIANTS_STAGE.sections;
