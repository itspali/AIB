"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { DocumentLayoutLocationOption } from "@/components/settings/document-layout/document-layout-scope-select";
import { SalesInvoiceDocumentLayoutPanel } from "@/components/settings/document-layout/sales-invoice-document-layout-panel";
import { SalesOrderDocumentLayoutPanel } from "@/components/settings/document-layout/sales-order-document-layout-panel";
import { SalesQuotationDocumentLayoutPanel } from "@/components/settings/document-layout/sales-quotation-document-layout-panel";
import { SalesApprovalsPanel } from "@/components/settings/modules/sales-approvals-panel";
import { SalesPoliciesPanel } from "@/components/settings/modules/sales-policies-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { SalesApprovalSettings } from "@/lib/sales/approval-settings";
import type { SalesDocumentConversionMode } from "@/lib/sales/document-conversion-settings";
import type { WorkspaceEligibleUser } from "@/lib/organization/queries";

type Props = {
  locations: DocumentLayoutLocationOption[];
  canEdit: boolean;
  gstRegistered: boolean;
  catalogFieldSuggestions?: PoCatalogFieldSuggestions;
  initialQuoteLayout: DocumentLayoutTemplate;
  initialOrderLayout: DocumentLayoutTemplate;
  initialInvoiceLayout: DocumentLayoutTemplate;
  approvalSettings: SalesApprovalSettings;
  documentConversionMode: SalesDocumentConversionMode;
  eligibleUsers: WorkspaceEligibleUser[];
  approverProfiles: WorkspaceEligibleUser[];
};

export function SalesModuleSettingsTerminal({
  locations,
  canEdit,
  gstRegistered,
  catalogFieldSuggestions,
  initialQuoteLayout,
  initialOrderLayout,
  initialInvoiceLayout,
  approvalSettings,
  documentConversionMode,
  eligibleUsers,
  approverProfiles,
}: Props) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const layoutDocParam = searchParams.get("layoutDoc");
  const initialTab =
    tabParam === "approvals" ? "approvals" : tabParam === "policies" ? "policies" : "layout";
  const initialLayoutDoc =
    layoutDocParam === "order"
      ? "order"
      : layoutDocParam === "invoice"
        ? "invoice"
        : "quote";

  return (
    <div className="canvas-scroll-endpad space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-xs" asChild>
          <Link href="/settings/modules">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" aria-hidden />
            Modules
          </Link>
        </Button>
        <span className="text-muted-foreground/40">/</span>
        <h1 className="text-lg font-semibold tracking-tight">Sales</h1>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList className="h-8">
          <TabsTrigger value="layout" className="h-7 px-3 text-xs">
            Document layout
          </TabsTrigger>
          <TabsTrigger value="approvals" className="h-7 px-3 text-xs">
            Approvals
          </TabsTrigger>
          <TabsTrigger value="policies" className="h-7 px-3 text-xs">
            Policies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="layout" className="mt-2">
          <Tabs defaultValue={initialLayoutDoc}>
            <TabsList className="mb-2 h-7">
              <TabsTrigger value="quote" className="h-6 px-2.5 text-xs">
                Quotation
              </TabsTrigger>
              <TabsTrigger value="order" className="h-6 px-2.5 text-xs">
                Sales order
              </TabsTrigger>
              <TabsTrigger value="invoice" className="h-6 px-2.5 text-xs">
                Invoice
              </TabsTrigger>
            </TabsList>

            <TabsContent value="quote">
              <SalesQuotationDocumentLayoutPanel
                initialLayout={initialQuoteLayout}
                locations={locations}
                canEdit={canEdit}
                gstRegistered={gstRegistered}
                catalogFieldSuggestions={catalogFieldSuggestions}
              />
            </TabsContent>

            <TabsContent value="order">
              <SalesOrderDocumentLayoutPanel
                initialLayout={initialOrderLayout}
                locations={locations}
                canEdit={canEdit}
                gstRegistered={gstRegistered}
                catalogFieldSuggestions={catalogFieldSuggestions}
              />
            </TabsContent>

            <TabsContent value="invoice">
              <SalesInvoiceDocumentLayoutPanel
                initialLayout={initialInvoiceLayout}
                locations={locations}
                canEdit={canEdit}
                gstRegistered={gstRegistered}
                catalogFieldSuggestions={catalogFieldSuggestions}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="approvals" className="mt-2">
          <SalesApprovalsPanel
            initialSettings={approvalSettings}
            canEdit={canEdit}
            eligibleUsers={eligibleUsers}
            approverProfiles={approverProfiles}
          />
        </TabsContent>

        <TabsContent value="policies" className="mt-2">
          <SalesPoliciesPanel
            initialDocumentConversionMode={documentConversionMode}
            canEdit={canEdit}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
