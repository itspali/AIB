"use client";

import { DOCUMENT_LAYOUT_MODULE_ADAPTERS } from "@/lib/documents/document-layout-module-adapters";
import {
  loadGoodsReceiptDocumentLayout,
  saveGoodsReceiptDocumentLayout,
} from "@/app/settings/operations/procurement/actions";
import { DocumentLayoutPanel } from "@/components/settings/document-layout/document-layout-panel";
import type { DocumentLayoutLocationOption } from "@/components/settings/document-layout/document-layout-scope-select";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";

type Props = {
  initialLayout: DocumentLayoutTemplate;
  locations?: DocumentLayoutLocationOption[];
  canEdit?: boolean;
  gstRegistered?: boolean;
  catalogFieldSuggestions?: PoCatalogFieldSuggestions;
};

export function GrnDocumentLayoutPanel(props: Props) {
  return (
    <DocumentLayoutPanel
      adapter={DOCUMENT_LAYOUT_MODULE_ADAPTERS.GOODS_RECEIPT_NOTE}
      loadLayout={loadGoodsReceiptDocumentLayout}
      saveLayout={saveGoodsReceiptDocumentLayout}
      {...props}
    />
  );
}
