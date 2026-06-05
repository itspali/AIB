"use client";

import { useState } from "react";
import { VariantAssortmentMatrix } from "@/components/products/variant-assortment-matrix";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { ProductVariantSnapshot } from "@/lib/products/types";
import { cn } from "@/lib/utils";

type Props = {
  itemId: string;
  variants: ProductVariantSnapshot[];
  readOnly?: boolean;
  compact?: boolean;
};

/** Per-SKU physical location assortment (Reach stage). */
export function VariantDistributionSection({
  itemId,
  variants,
  readOnly = false,
  compact,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  if (variants.length === 0) return null;

  return (
    <Accordion
      type="single"
      collapsible
      value={advancedOpen ? "advanced" : ""}
      onValueChange={(value) => setAdvancedOpen(value === "advanced")}
      className="border-0"
    >
      <AccordionItem value="advanced" className="border-0">
        <AccordionTrigger
          className={cn(
            "px-0 py-2 text-sm font-medium hover:no-underline",
            compact && "py-1.5 text-xs"
          )}
        >
          Physical locations
        </AccordionTrigger>
        <AccordionContent className="space-y-4 px-0 pb-2 pt-1">
          {advancedOpen ? (
            <VariantAssortmentMatrix itemId={itemId} variants={variants} readOnly={readOnly} />
          ) : null}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
