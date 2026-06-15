"use client";

import { useMemo } from "react";
import { normalizeSalesCommerceLayoutTemplate } from "@/lib/sales/shared/sales-commerce-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";

export function useSalesDocumentLayout(
  layout: DocumentLayoutTemplate
): DocumentLayoutTemplate {
  return useMemo(() => normalizeSalesCommerceLayoutTemplate(layout), [layout]);
}
