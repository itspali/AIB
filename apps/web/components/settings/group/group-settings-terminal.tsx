"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createTenantGroup, saveGroupSettings } from "@/app/settings/group/actions";
import { SettingsGlassShell } from "@/components/settings/settings-glass-shell";
import { CopyableReadonlyField } from "@/components/settings/copyable-readonly-field";
import { GroupDeleteConfirmDialog } from "@/components/settings/group/group-delete-confirm-dialog";
import { GroupEntityFieldsSection } from "@/components/settings/group/group-entity-fields-section";
import { GroupOrganizationsSection } from "@/components/settings/group/group-organizations-section";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { groupSettingsSchema } from "@/lib/group/schemas";
import {
  snapshotToGroupFormValues,
  type GroupOutboundInvitationRow,
  type GroupSettingsAccess,
  type GroupSettingsFormValues,
  type GroupSettingsSnapshot,
} from "@/lib/group/types";

export type GroupSettingsTerminalProps = {
  snapshot: GroupSettingsSnapshot | null;
  access: GroupSettingsAccess | null;
  canCreateGroup: boolean;
  defaultEmail: string;
  pendingInvitations?: GroupOutboundInvitationRow[];
};

export function GroupSettingsTerminal({
  snapshot,
  access,
  canCreateGroup,
  defaultEmail,
  pendingInvitations = [],
}: GroupSettingsTerminalProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [createName, setCreateName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const defaultValues = useMemo(
    () => (snapshot ? snapshotToGroupFormValues(snapshot) : null),
    [snapshot]
  );

  const form = useForm<GroupSettingsFormValues>({
    resolver: zodResolver(groupSettingsSchema),
    defaultValues: defaultValues ?? {
      name: "",
      legal_name: "",
      trade_name: "",
      primary_email: defaultEmail,
      primary_phone: "PENDING",
    },
  });

  if (!snapshot) {
    return (
      <SettingsGlassShell className="canvas-scroll-endpad mx-auto max-w-2xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Enterprise group</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a group to manage multiple organizations under one enterprise account.
          </p>
          {canCreateGroup ? (
            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new_group_name">Group name</Label>
                <Input
                  id="new_group_name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="AIB Holdings"
                />
              </div>
              <Button
                type="button"
                disabled={isPending || !createName.trim()}
                onClick={() => {
                  startTransition(async () => {
                    const result = await createTenantGroup({
                      name: createName.trim(),
                      primary_email: defaultEmail,
                    });
                    if ("error" in result && result.error) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Group created");
                    router.refresh();
                  });
                }}
              >
                Create group
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              You need workspace owner access to create a group.
            </p>
          )}
        </div>
      </SettingsGlassShell>
    );
  }

  const fieldsDisabled = !isEditing || isPending || !access?.granted;

  const onSave = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveGroupSettings({
        group_id: snapshot.group_id,
        ...values,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Group profile saved");
      setIsEditing(false);
      router.refresh();
    });
  });

  return (
    <SettingsGlassShell>
    <form
      onSubmit={onSave}
      className="canvas-scroll-endpad flex flex-col gap-4 lg:grid lg:grid-cols-[13fr_7fr] lg:gap-5"
    >
      <div className="space-y-4">
        <div className="sticky top-0 z-30 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
          <div>
            <h1 className="text-lg font-semibold sm:text-xl">{snapshot.name}</h1>
            <div className="mt-1 flex gap-2">
              <Badge variant="active">{snapshot.status}</Badge>
              {!snapshot.is_active ? <Badge variant="locked">Inactive</Badge> : null}
            </div>
          </div>
          {access?.granted ? (
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => {
                      form.reset(snapshotToGroupFormValues(snapshot));
                      setIsEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    Save
                  </Button>
                </>
              ) : (
                <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              )}
            </div>
          ) : null}
        </div>

        <OrgSettingsSection title="Group identity" description="Enterprise display and contact details.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {snapshot.group_code ? (
              <div className="md:col-span-2">
                <CopyableReadonlyField
                  id="group_code"
                  label="Group code"
                  value={snapshot.group_code}
                  description="Internal reference for this enterprise group. Organization workspace codes are used for invitations."
                />
              </div>
            ) : null}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="group_name">Group name</Label>
              <Input id="group_name" disabled={fieldsDisabled} {...form.register("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group_legal_name">Legal name</Label>
              <Input id="group_legal_name" disabled={fieldsDisabled} {...form.register("legal_name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group_trade_name">Trade name</Label>
              <Input id="group_trade_name" disabled={fieldsDisabled} {...form.register("trade_name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group_email">Primary email</Label>
              <Input
                id="group_email"
                type="email"
                disabled={fieldsDisabled}
                {...form.register("primary_email")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group_phone">Primary phone</Label>
              <Input id="group_phone" disabled={fieldsDisabled} {...form.register("primary_phone")} />
            </div>
          </div>
        </OrgSettingsSection>

        <GroupEntityFieldsSection snapshot={snapshot} access={access} />

        <GroupOrganizationsSection
          groupId={snapshot.group_id}
          organizations={snapshot.organizations}
          pendingInvitations={pendingInvitations}
          canManage={Boolean(access?.granted)}
        />

        {access?.isOwner ? (
          <div className="surface-panel border-destructive/30 bg-destructive/5 p-4">
            <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently delete this enterprise group after every organization has left and
              pending invitations are revoked.
            </p>
            <Button
              type="button"
              variant="destructive"
              className="mt-3"
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete group
            </Button>
          </div>
        ) : null}
      </div>

      <aside className="space-y-4">
        <div className="surface-panel">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Summary
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Organizations</dt>
              <dd className="tabular-nums font-medium">{snapshot.organizations.length}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Your role</dt>
              <dd className="font-medium">{access?.role ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </aside>

      <GroupDeleteConfirmDialog
        groupId={snapshot.group_id}
        groupName={snapshot.name}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </form>
    </SettingsGlassShell>
  );
}
