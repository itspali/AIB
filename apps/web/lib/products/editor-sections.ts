export type EditorSectionId =
  | "overview"
  | "salable"
  | "purchasable"
  | "inventory"
  | "variants"
  | "composition"
  | "media"
  | "product_attributes"
  | "custom_fields"
  | "tags"
  | "visibility";

/** Sections that require a persisted item id before they can be used. */
export const EDITOR_SECTIONS_HIDDEN_WHILE_CREATING: EditorSectionId[] = [
  "variants",
  "composition",
  "media",
];

const ALL_SECTION_IDS: EditorSectionId[] = [
  "overview",
  "salable",
  "purchasable",
  "inventory",
  "variants",
  "composition",
  "media",
  "product_attributes",
  "custom_fields",
  "tags",
  "visibility",
];

export function editorSectionIdsForItem(
  itemId: string | null | undefined,
  options?: { hasComposition?: boolean }
): EditorSectionId[] {
  const hasComposition = options?.hasComposition ?? false;
  if (itemId) {
    return ALL_SECTION_IDS.filter((id) => id !== "composition" || hasComposition);
  }
  return ALL_SECTION_IDS.filter(
    (id) =>
      !EDITOR_SECTIONS_HIDDEN_WHILE_CREATING.includes(id) &&
      (id !== "composition" || hasComposition)
  );
}

export function isEditorSectionVisible(
  id: EditorSectionId,
  itemId: string | null | undefined,
  options?: { hasComposition?: boolean }
): boolean {
  return editorSectionIdsForItem(itemId, options).includes(id);
}

