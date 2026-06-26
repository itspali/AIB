import { editorStageById } from "@/lib/products/editor-stages";
import type { EditorSectionId } from "@/lib/products/editor-sections";

export { ItemEssentialsStage, type ItemEssentialsStageModel } from "./item-essentials-stage";

/** Wizard stage metadata for Essentials (see docs/ITEM_CREATION_V2.md). */
export const ESSENTIALS_STAGE = editorStageById("essentials");

/** Editor sections rendered during the Essentials stage. */
export const ESSENTIALS_SECTIONS: EditorSectionId[] = ESSENTIALS_STAGE.sections;
