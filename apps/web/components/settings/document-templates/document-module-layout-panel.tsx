"use client";

import { memo } from "react";
import { BillDocumentLayoutPanel } from "@/components/settings/document-layout/bill-document-layout-panel";
import { GrnDocumentLayoutPanel } from "@/components/settings/document-layout/grn-document-layout-panel";
import { PurchaseOrderDocumentLayoutPanel } from "@/components/settings/document-layout/purchase-order-document-layout-panel";
import { SalesInvoiceDocumentLayoutPanel } from "@/components/settings/document-layout/sales-invoice-document-layout-panel";
import { SalesOrderDocumentLayoutPanel } from "@/components/settings/document-layout/sales-order-document-layout-panel";
import { SalesQuotationDocumentLayoutPanel } from "@/components/settings/document-layout/sales-quotation-document-layout-panel";
import type { DocumentLayoutLocationOption } from "@/components/settings/document-layout/document-layout-scope-select";
import type { DocumentLayoutEmbeddedToolbarActions } from "@/components/settings/document-layout/document-layout-panel";
import type { DocumentLayoutTemplate, DocumentModuleKey, DocumentViewContext } from "@/lib/documents/types";
import type { DocumentLayoutScope } from "@/lib/documents/layout-scope";
import type { PoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";

type Props = {
  moduleKey: DocumentModuleKey;
  initialLayout: DocumentLayoutTemplate;
  locations: DocumentLayoutLocationOption[];
  canEdit: boolean;
  gstRegistered: boolean;
  catalogFieldSuggestions?: PoCatalogFieldSuggestions;
  scope: DocumentLayoutScope;
  viewContext: DocumentViewContext;
  layoutSeeds?: Partial<Record<DocumentViewContext, DocumentLayoutTemplate>>;
  onLayoutChange: (layout: DocumentLayoutTemplate) => void;
  controlledLayout?: DocumentLayoutTemplate;
  controlledLayoutVersion?: number;
  onEmbeddedToolbarActionsChange?: (actions: DocumentLayoutEmbeddedToolbarActions | null) => void;
  afterSaveLayout?: () => Promise<{ error?: string } | void>;
};

const sharedEmbeddedProps = (props: Props) => ({
  initialLayout: props.initialLayout,
  locations: props.locations,
  canEdit: props.canEdit,
  gstRegistered: props.gstRegistered,
  embedded: true as const,
  compactFieldToolbar: true as const,
  hideChromeToolbar: true as const,
  controlledScope: props.scope,
  controlledViewContext: props.viewContext,
  controlledLayout: props.controlledLayout,
  controlledLayoutVersion: props.controlledLayoutVersion,
  layoutSeeds: props.layoutSeeds,
  onLayoutChange: props.onLayoutChange,
  onEmbeddedToolbarActionsChange: props.onEmbeddedToolbarActionsChange,
  afterSaveLayout: props.afterSaveLayout,
});

function DocumentModuleLayoutPanelInner(props: Props) {
  const shared = sharedEmbeddedProps(props);
  const catalog = props.catalogFieldSuggestions
    ? { catalogFieldSuggestions: props.catalogFieldSuggestions }
    : {};

  switch (props.moduleKey) {
    case "PURCHASE_ORDER":
      return <PurchaseOrderDocumentLayoutPanel {...shared} {...catalog} />;
    case "GOODS_RECEIPT_NOTE":
      return <GrnDocumentLayoutPanel {...shared} {...catalog} />;
    case "PURCHASE_INVOICE":
      return <BillDocumentLayoutPanel {...shared} {...catalog} />;
    case "SALES_QUOTATION":
      return <SalesQuotationDocumentLayoutPanel {...shared} />;
    case "SALES_ORDER":
      return <SalesOrderDocumentLayoutPanel {...shared} />;
    case "SALES_INVOICE":
      return <SalesInvoiceDocumentLayoutPanel {...shared} />;
    default:
      return null;
  }
}

export const DocumentModuleLayoutPanel = memo(DocumentModuleLayoutPanelInner);
