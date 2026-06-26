import { editorStageById } from "@/lib/products/editor-stages";
import type { EditorSectionId } from "@/lib/products/editor-sections";

export { ItemReachStage, type ItemReachStageModel } from "./item-reach-stage";

export const REACH_STAGE = editorStageById("reach");
export const REACH_SECTIONS: EditorSectionId[] = REACH_STAGE.sections;
