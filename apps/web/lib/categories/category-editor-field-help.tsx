/** Help copy for the category create/edit form (popover text on labels). */

export const CATEGORY_EDITOR_FIELD_HELP = {
  pageIntro: "Define the category tree and attribute schema for items in this category.",

  sectionBasics: "Name and place in the category tree.",

  sectionAttributes:
    "Fields items in this category can capture. Override inherited fields by using the same label.",

  name: "Display name shown in category pickers and the item editor.",

  parent:
    "Optional parent in your hierarchy. Child categories can inherit the parent's attribute schema.",

  inheritAttributes:
    "When on, items use merged attributes from parent categories plus any you define here. Turn off for a standalone schema.",

  inheritedFields:
    "Attributes currently inherited from the selected parent. Define matching labels on this category to override them.",

  active: "Inactive categories are hidden from item pickers but remain in the tree for reporting.",

  attributeEmpty:
    "No attributes yet. Add fields items should capture — for example Size or Material.",

  attributeAdd: "Adds another field to this category's item schema.",

  attributeLabel:
    "What authors see on items. An internal key is generated automatically from this label.",

  attributeType: "How the value is captured on items — text, number, single choice, and more.",

  attributeOptions:
    "Comma-separated choices for select-style types, e.g. Small, Medium, Large.",

  attributeVersionAxis:
    "Suggest this attribute as a version axis for multi-SKU items. Authors still choose per item.",

  attributeRequired: "When Yes, items must have a value for this attribute before they can be saved.",
} as const;
