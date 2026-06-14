"use client";

import { DOCUMENT_LAYOUT_MODULE_ADAPTERS } from "@/lib/documents/document-layout-module-adapters";
import {
  loadPurchaseOrderDocumentLayout,
  savePurchaseOrderDocumentLayout,
} from "@/app/settings/modules/procurement/actions";
import { DocumentLayoutPanel } from "@/components/settings/document-layout/document-layout-panel";
import type { DocumentLayoutLocationOption } from "@/components/settings/document-layout/document-layout-scope-select";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";

type Props = {
  initialLayout: DocumentLayoutTemplate;
  locations?: DocumentLayoutLocationOption[];
  canEdit?: boolean;
  catalogFieldSuggestions?: PoCatalogFieldSuggestions;
};

export function PurchaseOrderDocumentLayoutPanel(props: Props) {
  return (
    <DocumentLayoutPanel
      adapter={DOCUMENT_LAYOUT_MODULE_ADAPTERS.PURCHASE_ORDER}
      loadLayout={loadPurchaseOrderDocumentLayout}
      saveLayout={savePurchaseOrderDocumentLayout}
      {...props}
    />
  );
}
