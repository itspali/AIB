"use client";

import { useMemo } from "react";
import { mergePoScreenLayoutLocalOverrides } from "@/lib/documents/po-layout-local-overrides";
import { normalizePoLayoutTemplate } from "@/lib/documents/purchase-order-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";

/** Resolved PO document layout for drawer surfaces (tenant + optional local screen overrides). */
export function usePoDocumentLayout(
  layout: DocumentLayoutTemplate
): DocumentLayoutTemplate {
  return useMemo(
    () => mergePoScreenLayoutLocalOverrides(normalizePoLayoutTemplate(layout)),
    [layout]
  );
}
