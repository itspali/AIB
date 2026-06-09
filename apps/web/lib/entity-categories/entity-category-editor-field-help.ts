/** Help copy for entity category create/edit forms. */

export const ENTITY_CATEGORY_EDITOR_FIELD_HELP = {
  sectionBasics: "Name and place in the category tree.",

  sectionAttributes:
    "Fields entities in this category can capture. Override inherited fields by using the same label.",

  name: "Display name shown in category pickers and the entity editor.",

  parent:
    "Optional parent in your hierarchy. Child categories can inherit the parent's attribute schema.",

  inheritAttributes:
    "When on, entities use merged attributes from parent categories plus any you define here. Turn off for a standalone schema.",

  inheritedFields:
    "Attributes currently inherited from the selected parent. Define matching labels on this category to override them.",

  active:
    "Inactive categories are hidden from entity pickers but remain in the tree for reporting.",
} as const;
