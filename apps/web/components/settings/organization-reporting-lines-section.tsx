"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveTenantReportingLines } from "@/app/settings/organization/actions";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { TenantReportingLine } from "@/lib/organization/reporting-lines";

type Props = {
  initialLines: TenantReportingLine[];
  canEdit: boolean;
};

export function OrganizationReportingLinesSection({ initialLines, canEdit }: Props) {
  const [lines, setLines] = useState(initialLines);
  const [isPending, startTransition] = useTransition();

  const isDirty = useMemo(
    () => JSON.stringify(lines) !== JSON.stringify(initialLines),
    [initialLines, lines]
  );

  const managerOptions = (currentUserId: string) =>
    lines.filter((line) => line.user_id !== currentUserId);

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveTenantReportingLines(
        lines.map((line) => ({
          user_id: line.user_id,
          reports_to_user_id: line.reports_to_user_id,
        }))
      );
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Reporting lines saved.");
    });
  };

  return (
    <OrgSettingsSection
      title="Reporting lines"
      description="Who each person reports to. Used for manager-chain document approvals."
    >
      <p className="text-xs text-muted-foreground">
        Set a manager for submitters and approvers. Manager-chain workflows use these lines — see{" "}
        <Link href="/settings/modules/procurement?tab=approvals" className="text-primary hover:underline">
          Procurement approvals
        </Link>{" "}
        and{" "}
        <Link href="/settings/modules/sales?tab=approvals" className="text-primary hover:underline">
          Sales approvals
        </Link>
        .
      </p>

      <div className="space-y-2">
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active workspace members found.</p>
        ) : (
          lines.map((line) => {
            const name = `${line.first_name} ${line.last_name}`.trim() || line.email;
            return (
              <div
                key={line.user_id}
                className="grid gap-2 rounded-md border border-border px-3 py-2 sm:grid-cols-[1fr_220px]"
              >
                <div>
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {line.role} · {line.email}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reports to</Label>
                  <Select
                    value={line.reports_to_user_id ?? "none"}
                    disabled={!canEdit || isPending}
                    onValueChange={(value) => {
                      setLines((prev) =>
                        prev.map((entry) =>
                          entry.user_id === line.user_id
                            ? {
                                ...entry,
                                reports_to_user_id: value === "none" ? null : value,
                              }
                            : entry
                        )
                      );
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No manager</SelectItem>
                      {managerOptions(line.user_id).map((option) => (
                        <SelectItem key={option.user_id} value={option.user_id}>
                          {option.first_name} {option.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })
        )}
      </div>

      {canEdit ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={!isDirty || isPending} onClick={handleSave}>
            {isPending ? "Saving…" : "Save reporting lines"}
          </Button>
        </div>
      ) : null}
    </OrgSettingsSection>
  );
}
