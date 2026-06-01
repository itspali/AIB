import { describe, expect, it } from "vitest";
import {
  CLASSIFICATION_CHOICES,
  ITEM_CLASSIFICATIONS_FOR_PICKER,
  classificationDescription,
} from "@/lib/products/classification-labels";
import { ITEM_TYPE_CHOICES, ITEM_TYPES, itemTypeDescription } from "@/lib/products/item-model";

describe("item type and classification picker help text", () => {
  it("documents every item type option", () => {
    for (const value of ITEM_TYPES) {
      expect(itemTypeDescription(value).trim().length).toBeGreaterThan(0);
      expect(ITEM_TYPE_CHOICES.some((choice) => choice.value === value)).toBe(true);
    }
  });

  it("documents every supply-chain role shown in pickers", () => {
    for (const value of ITEM_CLASSIFICATIONS_FOR_PICKER) {
      expect(classificationDescription(value).trim().length).toBeGreaterThan(0);
      expect(CLASSIFICATION_CHOICES.some((choice) => choice.value === value)).toBe(true);
    }
  });
});
