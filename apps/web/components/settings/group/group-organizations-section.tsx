"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  completeGroupExit,
  createGroupOrganization,
  switchActiveTenantMembership,
} from "@/app/settings/group/actions";
import { createClient } from "@/lib/supabase/client";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { GroupOrganizationRow } from "@/lib/group/types";

type Props = {
  groupId: string;
  organizations: GroupOrganizationRow[];
  canManage: boolean;
};

export function GroupOrganizationsSection({ groupId, organizations, canManage }: Props) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createGroupOrganization({
        group_id: groupId,
        company_name: companyName,
        primary_email: primaryEmail,
        primary_phone: primaryPhone,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Organization created under group");
      setSheetOpen(false);
      setCompanyName("");
      setPrimaryEmail("");
      setPrimaryPhone("");
      router.refresh();
    });
  };

  const handleSwitch = (tenantId: string) => {
    startTransition(async () => {
      const result = await switchActiveTenantMembership(tenantId);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      const supabase = createClient();
      await supabase.auth.refreshSession();
      router.push("/dashboard");
      router.refresh();
    });
  };

  const handleExit = (tenantId: string, orgName: string) => {
    if (!confirm(`Remove "${orgName}" from this group? This cannot be undone without re-inviting.`)) {
      return;
    }
    startTransition(async () => {
      const result = await completeGroupExit(tenantId, "Spin-off from group");
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Organization removed from group");
      router.refresh();
    });
  };

  return (
    <OrgSettingsSection
      title="Organizations"
      description="Legal entities operating under this enterprise group."
    >
      {canManage ? (
        <div className="mb-4 flex justify-end">
          <Button type="button" size="sm" onClick={() => setSheetOpen(true)}>
            Add organization
          </Button>
        </div>
      ) : null}

      <div className="surface-inset overflow-x-auto rounded-lg">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 bg-background text-sm">
          <thead>
            <tr className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-2.5 font-medium">Name</th>
              <th className="p-2.5 font-medium">Status</th>
              <th className="p-2.5 font-medium">Members</th>
              <th className="p-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {organizations.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">
                  No organizations in this group yet.
                </td>
              </tr>
            ) : (
              organizations.map((org) => (
                <tr key={org.tenant_id} className="border-b border-border">
                  <td className="p-2.5">
                    <div className="font-medium">{org.trade_name || org.name}</div>
                    <div className="text-xs text-muted-foreground">{org.onboarding_status}</div>
                  </td>
                  <td className="p-2.5">
                    <Badge variant="default">{org.membership_status}</Badge>
                  </td>
                  <td className="p-2.5 tabular-nums">{org.member_count}</td>
                  <td className="space-x-2 p-2.5 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleSwitch(org.tenant_id)}
                    >
                      Open
                    </Button>
                    {canManage ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleExit(org.tenant_id, org.trade_name || org.name)}
                      >
                        Exit group
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add organization</SheetTitle>
            <SheetDescription>
              Create a new legal entity under this group. Assign an owner separately after creation.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org_name">Organization name</Label>
              <Input
                id="org_name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org_email">Primary email</Label>
              <Input
                id="org_email"
                type="email"
                value={primaryEmail}
                onChange={(e) => setPrimaryEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org_phone">Primary phone</Label>
              <Input
                id="org_phone"
                value={primaryPhone}
                onChange={(e) => setPrimaryPhone(e.target.value)}
              />
            </div>
            <Button type="button" className="w-full" disabled={isPending} onClick={handleCreate}>
              {isPending ? "Creating…" : "Create organization"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </OrgSettingsSection>
  );
}
