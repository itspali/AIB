"use client";

import {
  ProductEditorShell,
  type EditorWizardChrome,
} from "@/components/products/product-editor/product-editor-shell";
import { ItemEditorShell } from "@/components/items/item-editor/item-editor-shell";
import type { ComponentProps } from "react";

type ShellProps = ComponentProps<typeof ProductEditorShell>;

export type ItemCatalogWizardEditorProps = Omit<ShellProps, "wizard"> & {
  wizard: EditorWizardChrome;
};

/** Item wizard body: Glass V2 shell + existing ProductEditorShell stage sections. */
export function ItemCatalogWizardEditor({ wizard, ...shellProps }: ItemCatalogWizardEditorProps) {
  return (
    <ItemEditorShell stage={wizard.stage} layout={wizard.layout ?? "steps"}>
      <ProductEditorShell {...shellProps} wizard={wizard} />
    </ItemEditorShell>
  );
}
