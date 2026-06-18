"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SalesApprovalsPanel } from "@/components/settings/modules/sales-approvals-panel";
import { SalesPoliciesPanel } from "@/components/settings/modules/sales-policies-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SalesApprovalSettings } from "@/lib/sales/approval-settings";
import type { SalesDocumentConversionMode } from "@/lib/sales/document-conversion-settings";
import type { WorkspaceEligibleUser } from "@/lib/organization/queries";

type Props = {
  canEdit: boolean;
  approvalSettings: SalesApprovalSettings;
  documentConversionMode: SalesDocumentConversionMode;
  eligibleUsers: WorkspaceEligibleUser[];
  approverProfiles: WorkspaceEligibleUser[];
};

export function SalesModuleSettingsTerminal({
  canEdit,
  approvalSettings,
  documentConversionMode,
  eligibleUsers,
  approverProfiles,
}: Props) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "approvals" ? "approvals" : "policies";

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
          <TabsTrigger value="policies" className="h-7 px-3 text-xs">
            Policies
          </TabsTrigger>
          <TabsTrigger value="approvals" className="h-7 px-3 text-xs">
            Approvals
          </TabsTrigger>
        </TabsList>

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
