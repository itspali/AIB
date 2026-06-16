"use client";



import Link from "next/link";

import { useSearchParams } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { BillDocumentLayoutPanel } from "@/components/settings/document-layout/bill-document-layout-panel";

import { GrnDocumentLayoutPanel } from "@/components/settings/document-layout/grn-document-layout-panel";

import { PurchaseOrderDocumentLayoutPanel } from "@/components/settings/document-layout/purchase-order-document-layout-panel";

import type { DocumentLayoutLocationOption } from "@/components/settings/document-layout/document-layout-scope-select";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Button } from "@/components/ui/button";



import type { DocumentLayoutTemplate } from "@/lib/documents/types";

import type { PoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";

import { ProcurementApprovalsPanel } from "@/components/settings/modules/procurement-approvals-panel";

import { ProcurementFinancialAccountsPanel } from "@/components/settings/modules/procurement-financial-accounts-panel";

import { ProcurementPoliciesPanel } from "@/components/settings/modules/procurement-policies-panel";

import { saveProcurementApprovalSettings } from "@/app/settings/modules/procurement/actions";

import type { ProcurementApprovalSettings } from "@/lib/procurement/approval-settings";

import type {
  ExpenseAccountOption,
  FinancialProcurementSettings,
} from "@/lib/procurement/settings";

import type { WorkspaceEligibleUser } from "@/lib/organization/queries";



type Props = {

  locations: DocumentLayoutLocationOption[];

  canEdit: boolean;

  gstRegistered: boolean;

  catalogFieldSuggestions?: PoCatalogFieldSuggestions;

  initialPoLayout: DocumentLayoutTemplate;

  initialGrnLayout: DocumentLayoutTemplate;

  initialBillLayout: DocumentLayoutTemplate;

  procurementSettings: Pick<

    import("@/lib/procurement/settings").ProcurementSettings,

    | "po_auto_round_off_enabled"

    | "po_auto_round_off_step"

    | "is_po_mandatory_for_grn"

    | "is_qc_required_before_stocking"

    | "allow_qc_line_override"

    | "allow_zero_cost_receipts"

    | "promo_default_category"

    | "landed_cost_allocation_method"

    | "absorb_sunk_logistics_overhead"

    | "matching_tolerance_percentage"

    | "po_mrp_trade_terms_enabled"

    | "allow_edit_issued_purchase_orders"

    | "allow_line_item_discounts"

    | "allow_transaction_discounts"

    | "purchase_prices_tax_inclusive"

  >;

  approvalSettings: ProcurementApprovalSettings;

  eligibleUsers: WorkspaceEligibleUser[];

  approverProfiles: WorkspaceEligibleUser[];

  financialSettings: FinancialProcurementSettings;

  expenseAccounts: ExpenseAccountOption[];

  liabilityAccounts: ExpenseAccountOption[];

};



export function ProcurementModuleSettingsTerminal({

  locations,

  canEdit,

  gstRegistered,

  catalogFieldSuggestions,

  initialPoLayout,

  initialGrnLayout,

  initialBillLayout,

  procurementSettings,

  approvalSettings,

  eligibleUsers,

  approverProfiles,

  financialSettings,

  expenseAccounts,

  liabilityAccounts,

}: Props) {

  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");

  const layoutDocParam = searchParams.get("layoutDoc");

  const initialTab =

    tabParam === "policies" ? "policies" : tabParam === "approvals" ? "approvals" : "layout";

  const initialLayoutDoc =

    layoutDocParam === "grn"

      ? "grn"

      : layoutDocParam === "bill"

        ? "bill"

        : "po";



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

        <h1 className="text-lg font-semibold tracking-tight">Procurement</h1>

      </div>



      <Tabs defaultValue={initialTab}>

        <TabsList className="h-8">

          <TabsTrigger value="layout" className="h-7 px-3 text-xs">

            Document layout

          </TabsTrigger>

          <TabsTrigger value="policies" className="h-7 px-3 text-xs">

            Policies

          </TabsTrigger>

          <TabsTrigger value="approvals" className="h-7 px-3 text-xs">

            Approvals

          </TabsTrigger>

        </TabsList>



        <TabsContent value="layout" className="mt-2">

          <Tabs defaultValue={initialLayoutDoc}>

            <TabsList className="mb-2 h-7">

              <TabsTrigger value="po" className="h-6 px-2.5 text-xs">Purchase order</TabsTrigger>

              <TabsTrigger value="grn" className="h-6 px-2.5 text-xs">GRN</TabsTrigger>

              <TabsTrigger value="bill" className="h-6 px-2.5 text-xs">Bill</TabsTrigger>

            </TabsList>

            <TabsContent value="po">

              <PurchaseOrderDocumentLayoutPanel

                initialLayout={initialPoLayout}

                locations={locations}

                canEdit={canEdit}

                gstRegistered={gstRegistered}

                catalogFieldSuggestions={catalogFieldSuggestions}

              />

            </TabsContent>

            <TabsContent value="grn">

              <GrnDocumentLayoutPanel

                initialLayout={initialGrnLayout}

                locations={locations}

                canEdit={canEdit}

                gstRegistered={gstRegistered}

                catalogFieldSuggestions={catalogFieldSuggestions}

              />

            </TabsContent>

            <TabsContent value="bill">

              <BillDocumentLayoutPanel

                initialLayout={initialBillLayout}

                locations={locations}

                canEdit={canEdit}

                gstRegistered={gstRegistered}

                catalogFieldSuggestions={catalogFieldSuggestions}

              />

            </TabsContent>

          </Tabs>

        </TabsContent>



        <TabsContent value="approvals" className="mt-2">

          <ProcurementApprovalsPanel

            initialSettings={approvalSettings}

            canEdit={canEdit}

            eligibleUsers={eligibleUsers}

            approverProfiles={approverProfiles}

            onSave={saveProcurementApprovalSettings}

          />

        </TabsContent>



        <TabsContent value="policies" className="mt-2">

          <div className="space-y-4">

          <ProcurementPoliciesPanel

            canEdit={canEdit}

            initialSettings={{

              po_auto_round_off_enabled: procurementSettings.po_auto_round_off_enabled,

              po_auto_round_off_step: procurementSettings.po_auto_round_off_step,

              is_po_mandatory_for_grn: procurementSettings.is_po_mandatory_for_grn,

              is_qc_required_before_stocking: procurementSettings.is_qc_required_before_stocking,

              allow_qc_line_override: procurementSettings.allow_qc_line_override,

              allow_zero_cost_receipts: procurementSettings.allow_zero_cost_receipts,

              promo_default_category: procurementSettings.promo_default_category,

              landed_cost_allocation_method: procurementSettings.landed_cost_allocation_method,

              absorb_sunk_logistics_overhead: procurementSettings.absorb_sunk_logistics_overhead,

              matching_tolerance_percentage: procurementSettings.matching_tolerance_percentage,

              po_mrp_trade_terms_enabled: procurementSettings.po_mrp_trade_terms_enabled,

              allow_edit_issued_purchase_orders:

                procurementSettings.allow_edit_issued_purchase_orders,

              allow_line_item_discounts: procurementSettings.allow_line_item_discounts,

              allow_transaction_discounts: procurementSettings.allow_transaction_discounts,

              purchase_prices_tax_inclusive: procurementSettings.purchase_prices_tax_inclusive,

            }}

          />

          <ProcurementFinancialAccountsPanel

            initialSettings={financialSettings}

            expenseAccounts={expenseAccounts}

            liabilityAccounts={liabilityAccounts}

            canEdit={canEdit}

          />

          </div>

        </TabsContent>

      </Tabs>

    </div>

  );

}

