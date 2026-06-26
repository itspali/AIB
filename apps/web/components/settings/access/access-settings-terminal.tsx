"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { saveOrganizationSettings } from "@/app/settings/company/actions";
import { OrganizationAccessSection } from "@/components/settings/organization-access-section";
import { SettingsGlassShell } from "@/components/settings/settings-glass-shell";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Button } from "@/components/ui/button";
import { organizationSettingsSchema } from "@/lib/organization/schemas";
import type { OrganizationSettingsAccess } from "@/lib/organization/access";
import type { TenantReportingLine } from "@/lib/organization/reporting-lines";
import {
  snapshotToFormValues,
  type OrganizationSettingsFormValues,
  type OrganizationSettingsSnapshot,
} from "@/lib/organization/types";

export type AccessSettingsTerminalProps = {
  snapshot: OrganizationSettingsSnapshot;
  access: OrganizationSettingsAccess;
  reportingLines: TenantReportingLine[];
};

export function AccessSettingsTerminal({
  snapshot,
  access,
  reportingLines,
}: AccessSettingsTerminalProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const defaultValues = useMemo(() => snapshotToFormValues(snapshot), [snapshot]);
  const form = useForm<OrganizationSettingsFormValues>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
    setIsEditing(false);
  }, [defaultValues, form]);

  const fieldsDisabled = !isEditing || isPending || !access.granted;

  const onSave = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveOrganizationSettings(values);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Access settings saved");
      setIsEditing(false);
      router.refresh();
    });
  });

  return (
    <div className="canvas-scroll-endpad space-y-6">
      <OrgSettingsSection
        title="Members & roles"
        description="Invite team members, assign roles, and manage workspace membership."
      >
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-border px-4 py-6">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Coming soon</p>
            <p className="text-xs text-muted-foreground">
              Planned sections: Members, Roles, Delegations, Invitations.
            </p>
          </div>
        </div>
      </OrgSettingsSection>

      <form onSubmit={onSave} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold sm:text-xl">Access & delegates</h1>
            <p className="text-sm text-muted-foreground">
              Search visibility, settings delegates, and field access policies.
            </p>
          </div>
          {access.granted ? (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      form.reset(defaultValues);
                      setIsEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={isPending}>
                    Save changes
                  </Button>
                </>
              ) : (
                <Button type="button" size="sm" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              )}
            </div>
          ) : null}
        </div>

        <SettingsGlassShell>
          <OrganizationAccessSection
            form={form}
            snapshot={snapshot}
            access={access}
            reportingLines={reportingLines}
            disabled={fieldsDisabled}
          />
        </SettingsGlassShell>
      </form>
    </div>
  );
}
