"use client";

import { Boxes } from "lucide-react";
import {
  compositionEmptyStateMessage,
  compositionRoleAllowsComponents,
} from "@/lib/products/composition";
import type { ItemClassification } from "@/lib/products/classification-labels";
import {
  editorEmptyStateClass,
  useEditorPanelLayout,
} from "@/lib/products/editor-chrome";
import { cn } from "@/lib/utils";

type Props = {
  classification: ItemClassification;
  hasItemId: boolean;
};

export function ProductCompositionSection({ classification, hasItemId }: Props) {
  const isPanelLayout = useEditorPanelLayout();

  if (!compositionRoleAllowsComponents(classification)) {
    return (
      <p className={editorEmptyStateClass(isPanelLayout)}>
        Sold as a set is only configured for finished goods and work-in-progress items. Change
        supply-chain role on Basics, or turn off Sold as a set.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-8 text-center",
        isPanelLayout ? "text-xs" : "text-sm"
      )}
    >
      <Boxes className="h-8 w-8 text-muted-foreground/70" aria-hidden />
      <p className="max-w-md text-muted-foreground">
        {compositionEmptyStateMessage(classification, hasItemId)}
      </p>
    </div>
  );
}
