"use client";

import { SETTINGS_ROUTES } from "@/lib/settings/navigation";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SettingsGlassShell } from "@/components/settings/settings-glass-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ProcurementApprovalsPanel } from "@/components/settings/modules/procurement-approvals-panel";
import { ProcurementFinancialAccountsPanel } from "@/components/settings/modules/procurement-financial-accounts-panel";
import { ProcurementPoliciesPanel } from "@/components/settings/modules/procurement-policies-panel";
import { saveProcurementApprovalSettings } from "@/app/settings/operations/procurement/actions";
import type { ProcurementApprovalSettings } from "@/lib/procurement/approval-settings";
import type {
  ExpenseAccountOption,
  FinancialProcurementSettings,
} from "@/lib/procurement/settings";
import type { ImportLogisticsSettings } from "@/lib/procurement/import-logistics-settings";
import { ImportLogisticsPoliciesPanel } from "@/components/settings/modules/import-logistics-policies-panel";
import { ProcurementImportEnablePanel } from "@/components/settings/modules/procurement-import-enable-panel";
import { isImportLogisticsEnabled } from "@/lib/procurement/import-logistics-capability";
import type { WorkspaceEligibleUser } from "@/lib/organization/queries";

type Props = {
  canEdit: boolean;
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
  assetAccounts: ExpenseAccountOption[];
  liabilityAccounts: ExpenseAccountOption[];
  importLogisticsSettings: ImportLogisticsSettings;
};

export function ProcurementModuleSettingsTerminal({
  canEdit,
  procurementSettings,
  approvalSettings,
  eligibleUsers,
  approverProfiles,
  financialSettings,
  expenseAccounts,
  assetAccounts,
  liabilityAccounts,
  importLogisticsSettings,
}: Props) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const importsEnabled = isImportLogisticsEnabled(importLogisticsSettings);
  const initialTab =
    tabParam === "approvals"
      ? "approvals"
      : tabParam === "import" && importsEnabled
        ? "import"
        : "policies";

  return (
    <div className="canvas-scroll-endpad space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-xs" asChild>
          <Link href={SETTINGS_ROUTES.operations}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" aria-hidden />
            Modules
          </Link>
        </Button>
        <span className="text-muted-foreground/40">/</span>
        <h1 className="text-lg font-semibold tracking-tight">Procurement</h1>
      </div>

      <SettingsGlassShell>
      <Tabs defaultValue={initialTab}>
        <TabsList className="h-8">
          <TabsTrigger value="policies" className="h-7 px-3 text-xs">
            Policies
          </TabsTrigger>
          {importsEnabled ? (
            <TabsTrigger value="import" className="h-7 px-3 text-xs">
              Import & logistics
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="approvals" className="h-7 px-3 text-xs">
            Approvals
          </TabsTrigger>
        </TabsList>

        {importsEnabled ? (
          <TabsContent value="import" className="mt-2">
            <ImportLogisticsPoliciesPanel
              canEdit={canEdit}
              initialSettings={importLogisticsSettings}
            />
          </TabsContent>
        ) : null}

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
            <ProcurementImportEnablePanel
              canEdit={canEdit}
              initialSettings={importLogisticsSettings}
            />
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
              assetAccounts={assetAccounts}
              liabilityAccounts={liabilityAccounts}
              canEdit={canEdit}
              importsEnabled={importsEnabled}
            />
          </div>
        </TabsContent>
      </Tabs>
      </SettingsGlassShell>
    </div>
  );
}
