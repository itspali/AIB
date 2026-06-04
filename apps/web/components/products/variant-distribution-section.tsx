"use client";

import { useState } from "react";
import { VariantAssortmentMatrix } from "@/components/products/variant-assortment-matrix";
import { VariantChannelAvailabilityMatrix } from "@/components/products/variant-channel-availability-matrix";
import { ProductChannelDefaults } from "@/components/products/product-channel-defaults";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { ProductCatalogContext, ProductMasterFormValues, ProductVariantSnapshot } from "@/lib/products/types";
import { editorPanelDividerClass } from "@/lib/products/editor-chrome";
import { cn } from "@/lib/utils";

type Props = {
  itemId: string;
  variants: ProductVariantSnapshot[];
  catalogContext: ProductCatalogContext;
  storefrontVisibility: ProductMasterFormValues["storefront_visibility"];
  readOnly?: boolean;
  compact?: boolean;
  onStorefrontVisibilityChange: (
    value: ProductMasterFormValues["storefront_visibility"]
  ) => void;
};

/**
 * Simple product-level channel defaults plus per-SKU assortment and channel grids
 * under Advanced.
 */
export function VariantDistributionSection({
  itemId,
  variants,
  catalogContext,
  storefrontVisibility,
  readOnly = false,
  compact,
  onStorefrontVisibilityChange,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  if (variants.length === 0) return null;

  return (
    <div className="space-y-4">
      <ProductChannelDefaults
        storefronts={catalogContext.storefronts}
        values={storefrontVisibility}
        disabled={readOnly}
        compact={compact}
        onChange={onStorefrontVisibilityChange}
      />

      <Accordion
        type="single"
        collapsible
        value={advancedOpen ? "advanced" : ""}
        onValueChange={(value) => setAdvancedOpen(value === "advanced")}
        className={cn(compact && editorPanelDividerClass(), "border-0")}
      >
        <AccordionItem value="advanced" className="border-0">
          <AccordionTrigger
            className={cn(
              "px-0 py-2 text-sm font-medium hover:no-underline",
              compact && "py-1.5 text-xs"
            )}
          >
            Per-SKU channels &amp; locations
          </AccordionTrigger>
          <AccordionContent className="space-y-4 px-0 pb-2 pt-1">
            {advancedOpen ? (
              <>
                <VariantChannelAvailabilityMatrix
                  itemId={itemId}
                  variants={variants}
                  readOnly={readOnly}
                />
                <VariantAssortmentMatrix
                  itemId={itemId}
                  variants={variants}
                  readOnly={readOnly}
                />
              </>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
