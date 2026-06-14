"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SalesApprovalsPanel } from "@/components/settings/modules/sales-approvals-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SalesApprovalSettings } from "@/lib/sales/approval-settings";
import type { WorkspaceEligibleUser } from "@/lib/organization/queries";

type Props = {
  canEdit: boolean;
  approvalSettings: SalesApprovalSettings;
  eligibleUsers: WorkspaceEligibleUser[];
  approverProfiles: WorkspaceEligibleUser[];
};

export function SalesModuleSettingsTerminal({
  canEdit,
  approvalSettings,
  eligibleUsers,
  approverProfiles,
}: Props) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "approvals" ? "approvals" : "layout";

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
        </TabsList>

        <TabsContent value="layout" className="mt-2">
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
            <p className="text-sm font-medium">Document layout settings</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Quotation, sales order, and invoice layout editors will appear here in a future update.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="approvals" className="mt-2">
          <SalesApprovalsPanel
            initialSettings={approvalSettings}
            canEdit={canEdit}
            eligibleUsers={eligibleUsers}
            approverProfiles={approverProfiles}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
