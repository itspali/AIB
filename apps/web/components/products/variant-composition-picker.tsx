"use client";

import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { VariantAxisChipSelector } from "@/components/products/variant-axis-chip-selector";

type Props = {
  templates: AttributeTemplateEntry[];
  axisKeys: string[];
  suggestedAxisKeys?: string[];
  disabled?: boolean;
  compact?: boolean;
  onChange: (axisKeys: string[]) => void;
};

/** Category attributes that split this product into sellable SKUs. */
export function VariantCompositionPicker(props: Props) {
  return <VariantAxisChipSelector {...props} />;
}
