"use client";

import { QcTestTemplateScopePanel } from "@/components/procurement/quality-inspection/qc-test-template-scope-panel";
import { INSPECTION_TESTS_SAVE_FIRST_HINT } from "@/lib/products/product-user-labels";

type Props = {
  itemId: string | null;
  readOnly: boolean;
  name: string;
};

export function ItemQualityInspectionSection({ itemId, readOnly, name }: Props) {
  if (!itemId) {
    return (
      <p className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        {INSPECTION_TESTS_SAVE_FIRST_HINT}
      </p>
    );
  }

  return (
    <QcTestTemplateScopePanel
      scopeType="ITEM"
      scopeReferenceId={itemId}
      scopeLabel="item"
      readOnly={readOnly}
      defaultTemplateName={name}
      hideIntro
    />
  );
}
