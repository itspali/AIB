"use client";

import { PriceBookEntryEditor } from "@/components/products/price-book-entry-editor";
import {
  PRICE_BOOK_SAVE_FIRST_HINT,
  PRICE_BOOK_SECTION_DESCRIPTION,
} from "@/lib/products/product-user-labels";
import { editorEmptyStateClass } from "@/lib/products/editor-chrome";
import type { ProductVariantSnapshot } from "@/lib/products/types";

type Props = {
  isPanelLayout: boolean;
  isSalable: boolean;
  itemId: string | null;
  variants: ProductVariantSnapshot[];
  priceBookUomCodes: string[];
  readOnly: boolean;
  isMounted: boolean;
};

export function ItemPriceBookSection({
  isPanelLayout,
  isSalable,
  itemId,
  variants,
  priceBookUomCodes,
  readOnly,
  isMounted,
}: Props) {
  if (!isSalable) {
    return (
      <p className={editorEmptyStateClass(isPanelLayout)}>
        Turn on Sellable under Basics to manage price book entries.
      </p>
    );
  }

  if (!itemId) {
    return (
      <p className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        {PRICE_BOOK_SAVE_FIRST_HINT}
      </p>
    );
  }

  if (!isMounted) {
    return <p className="text-sm text-muted-foreground">{PRICE_BOOK_SECTION_DESCRIPTION}</p>;
  }

  return (
    <PriceBookEntryEditor
      itemId={itemId}
      variants={variants}
      uomCodes={priceBookUomCodes}
      readOnly={readOnly}
    />
  );
}
