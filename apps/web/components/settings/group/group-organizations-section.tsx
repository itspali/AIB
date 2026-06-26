"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createGroupOrganization,
  inviteOrganizationToGroup,
  reinstateGroupOrganization,
  revokeGroupInvitation,
  suspendGroupOrganization,
  switchActiveTenantMembership,
} from "@/app/settings/enterprise/actions";
import { createClient } from "@/lib/supabase/client";
import { GroupExitConfirmDialog } from "@/components/settings/group/group-exit-confirm-dialog";
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
import { formatDate } from "@/lib/dashboard/format";
import type { GroupOrganizationRow, GroupOutboundInvitationRow } from "@/lib/group/types";
import { cn } from "@/lib/utils";

type Props = {
  groupId: string;
  organizations: GroupOrganizationRow[];
  pendingInvitations: GroupOutboundInvitationRow[];
  canManage: boolean;
};

type ExitTarget = {
  tenantId: string;
  orgName: string;
};

function membershipBadgeVariant(status: GroupOrganizationRow["membership_status"]) {
  if (status === "SUSPENDED") return "locked" as const;
  if (status === "EXIT_PENDING") return "active" as const;
  return "default" as const;
}

export function GroupOrganizationsSection({
  groupId,
  organizations,
  pendingInvitations,
  canManage,
}: Props) {
  const router = useRouter();
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [exitTarget, setExitTarget] = useState<ExitTarget | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
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
      setCreateSheetOpen(false);
      setCompanyName("");
      setPrimaryEmail("");
      setPrimaryPhone("");
      router.refresh();
    });
  };

  const handleInvite = () => {
    startTransition(async () => {
      const result = await inviteOrganizationToGroup({
        group_id: groupId,
        identifier: inviteIdentifier.trim(),
        message: inviteMessage,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Invitation sent");
      setInviteSheetOpen(false);
      setInviteIdentifier("");
      setInviteMessage("");
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

  const handleSuspend = (tenantId: string, orgName: string) => {
    if (!confirm(`Suspend "${orgName}" in this group? Members lose access until reinstated.`)) {
      return;
    }
    startTransition(async () => {
      const result = await suspendGroupOrganization({
        tenant_id: tenantId,
        reason: "Suspended by group admin",
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Organization suspended");
      router.refresh();
    });
  };

  const handleReinstate = (tenantId: string) => {
    startTransition(async () => {
      const result = await reinstateGroupOrganization(tenantId);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Organization reinstated");
      router.refresh();
    });
  };

  const handleRevokeInvitation = (invitationId: string, orgName: string) => {
    if (!confirm(`Revoke invitation for "${orgName}"?`)) return;
    startTransition(async () => {
      const result = await revokeGroupInvitation(invitationId);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Invitation revoked");
      router.refresh();
    });
  };

  return (
    <OrgSettingsSection
      title="Organizations"
      description="Legal entities operating under this enterprise group."
    >
      {canManage ? (
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setInviteSheetOpen(true)}>
            Invite organization
          </Button>
          <Button type="button" size="sm" onClick={() => setCreateSheetOpen(true)}>
            Add organization
          </Button>
        </div>
      ) : null}

      {canManage && pendingInvitations.length > 0 ? (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pending invitations
          </p>
          <div className="surface-inset divide-y divide-border rounded-lg">
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation.invitation_id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{invitation.organization_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {formatDate(invitation.expires_at)}
                    {invitation.message ? ` · ${invitation.message}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    handleRevokeInvitation(
                      invitation.invitation_id,
                      invitation.organization_name
                    )
                  }
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="surface-inset table-chrome-frame overflow-x-auto rounded-lg">
        <table
          data-header-tone="subtle"
          className="table-chrome w-full min-w-[720px] border-separate border-spacing-0 bg-background text-sm"
        >
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-2.5 font-medium">Name</th>
              <th className="p-2.5 font-medium">Code</th>
              <th className="p-2.5 font-medium">Status</th>
              <th className="p-2.5 font-medium">Members</th>
              <th className="p-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {organizations.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
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
                  <td className="p-2.5 font-mono text-xs">{org.organization_code}</td>
                  <td className="p-2.5">
                    <Badge variant={membershipBadgeVariant(org.membership_status)}>
                      {org.membership_status}
                    </Badge>
                  </td>
                  <td className="p-2.5 tabular-nums">{org.member_count}</td>
                  <td className="space-x-2 p-2.5 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending || org.membership_status === "SUSPENDED"}
                      onClick={() => handleSwitch(org.tenant_id)}
                    >
                      Open
                    </Button>
                    {canManage && org.membership_status === "ACTIVE" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleSuspend(org.tenant_id, org.trade_name || org.name)}
                      >
                        Suspend
                      </Button>
                    ) : null}
                    {canManage && org.membership_status === "SUSPENDED" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleReinstate(org.tenant_id)}
                      >
                        Reinstate
                      </Button>
                    ) : null}
                    {canManage ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(org.membership_status === "SUSPENDED" && "text-destructive")}
                        disabled={isPending}
                        onClick={() =>
                          setExitTarget({
                            tenantId: org.tenant_id,
                            orgName: org.trade_name || org.name,
                          })
                        }
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

      <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
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

      <Sheet open={inviteSheetOpen} onOpenChange={setInviteSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Invite organization</SheetTitle>
            <SheetDescription>
              Invite a standalone organization using its primary email or workspace code (e.g.
              ORG-AB12CD). The target owner accepts from Organization settings.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite_identifier">Primary email or workspace code</Label>
              <Input
                id="invite_identifier"
                value={inviteIdentifier}
                onChange={(e) => setInviteIdentifier(e.target.value)}
                placeholder="billing@acme.com or ORG-AB12CD"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite_message">Message (optional)</Label>
              <textarea
                id="invite_message"
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                rows={3}
                className="flex min-h-[5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={isPending || !inviteIdentifier.trim()}
              onClick={handleInvite}
            >
              {isPending ? "Sending…" : "Send invitation"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <GroupExitConfirmDialog
        tenantId={exitTarget?.tenantId ?? null}
        orgName={exitTarget?.orgName ?? null}
        open={exitTarget != null}
        onOpenChange={(open) => {
          if (!open) setExitTarget(null);
        }}
        onCompleted={() => {
          setExitTarget(null);
          router.refresh();
        }}
      />
    </OrgSettingsSection>
  );
}
