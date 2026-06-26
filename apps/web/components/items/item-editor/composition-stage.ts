import { editorStageById } from "@/lib/products/editor-stages";
import type { EditorSectionId } from "@/lib/products/editor-sections";

export { ItemCompositionStage, type ItemCompositionStageModel } from "./item-composition-stage";

export const COMPOSITION_STAGE = editorStageById("composition");
export const COMPOSITION_SECTIONS: EditorSectionId[] = COMPOSITION_STAGE.sections;
