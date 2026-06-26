"use client";

import {
  loadSalesInvoiceDocumentLayout,
  saveSalesInvoiceDocumentLayout,
} from "@/app/settings/operations/sales/actions";
import { DocumentLayoutPanel } from "@/components/settings/document-layout/document-layout-panel";
import type { DocumentLayoutLocationOption } from "@/components/settings/document-layout/document-layout-scope-select";
import { DOCUMENT_LAYOUT_MODULE_ADAPTERS } from "@/lib/documents/document-layout-module-adapters";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";

type Props = {
  initialLayout: DocumentLayoutTemplate;
  locations?: DocumentLayoutLocationOption[];
  canEdit?: boolean;
  gstRegistered?: boolean;
  catalogFieldSuggestions?: PoCatalogFieldSuggestions;
};

export function SalesInvoiceDocumentLayoutPanel(props: Props) {
  return (
    <DocumentLayoutPanel
      adapter={DOCUMENT_LAYOUT_MODULE_ADAPTERS.SALES_INVOICE}
      loadLayout={loadSalesInvoiceDocumentLayout}
      saveLayout={saveSalesInvoiceDocumentLayout}
      {...props}
    />
  );
}
