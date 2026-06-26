"use client";

import { DOCUMENT_LAYOUT_MODULE_ADAPTERS } from "@/lib/documents/document-layout-module-adapters";
import {
  loadPurchaseInvoiceDocumentLayout,
  savePurchaseInvoiceDocumentLayout,
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

export function BillDocumentLayoutPanel(props: Props) {
  return (
    <DocumentLayoutPanel
      adapter={DOCUMENT_LAYOUT_MODULE_ADAPTERS.PURCHASE_INVOICE}
      loadLayout={loadPurchaseInvoiceDocumentLayout}
      saveLayout={savePurchaseInvoiceDocumentLayout}
      {...props}
    />
  );
}
