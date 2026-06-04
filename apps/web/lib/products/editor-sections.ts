export type EditorSectionId =
  | "overview"
  | "salable"
  | "purchasable"
  | "inventory"
  | "variants"
  | "media"
  | "catalog"
  | "reach";

/** Sections that require a persisted item id before they can be used. */
export const EDITOR_SECTIONS_HIDDEN_WHILE_CREATING: EditorSectionId[] = ["variants", "media"];

const ALL_SECTION_IDS: EditorSectionId[] = [
  "overview",
  "salable",
  "purchasable",
  "inventory",
  "variants",
  "media",
  "catalog",
  "reach",
];

export function editorSectionIdsForItem(itemId: string | null | undefined): EditorSectionId[] {
  if (itemId) return ALL_SECTION_IDS;
  return ALL_SECTION_IDS.filter((id) => !EDITOR_SECTIONS_HIDDEN_WHILE_CREATING.includes(id));
}

export function isEditorSectionVisible(
  id: EditorSectionId,
  itemId: string | null | undefined
): boolean {
  return editorSectionIdsForItem(itemId).includes(id);
}
