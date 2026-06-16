"use client";

import { useMemo } from "react";
import { applyGstRegisteredDocumentLayoutOverrides } from "@/lib/documents/gst-document-layout-compliance";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import {
  createSalesCatalogFieldPref,
  normalizeSalesCommerceLayoutTemplate,
} from "@/lib/sales/shared/sales-commerce-layout";

export function useSalesDocumentLayout(
  layout: DocumentLayoutTemplate,
  gstRegistered = false
): DocumentLayoutTemplate {
  return useMemo(() => {
    const normalized = normalizeSalesCommerceLayoutTemplate(layout);
    return gstRegistered
      ? applyGstRegisteredDocumentLayoutOverrides(
          normalized,
          true,
          createSalesCatalogFieldPref
        )
      : normalized;
  }, [layout, gstRegistered]);
}
