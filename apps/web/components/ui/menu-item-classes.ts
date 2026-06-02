/** Base styles for Radix menu/select rows. Use `group` on the item for hover check affordance. */
export const menuItemHighlightClassName = "group outline-none transition-colors duration-150";

/** Selected value in a Select list. */
export const selectItemCheckedClassName = "data-[state=checked]:font-medium";

/** Check shown on keyboard/pointer highlight; hidden when the real ItemIndicator is visible. */
export const selectItemHoverCheckClassName =
  "h-4 w-4 opacity-0 group-data-[highlighted]:opacity-100 group-data-[state=checked]:hidden";
