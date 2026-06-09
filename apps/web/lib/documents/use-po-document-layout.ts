"use client";

import { useMemo } from "react";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  normalizePoLayoutTemplate,
} from "@/lib/documents/purchase-order-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";

/** Resolved PO document layout for drawer surfaces (defaults until tenant layout is persisted). */
export function usePoDocumentLayout(
  layout: DocumentLayoutTemplate = DEFAULT_PO_SCREEN_LAYOUT
): DocumentLayoutTemplate {
  return useMemo(() => normalizePoLayoutTemplate(layout), [layout]);
}
