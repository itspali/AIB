"use client";

import { useState } from "react";
import Link from "next/link";
import { SETTINGS_ROUTES } from "@/lib/settings/navigation";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorkspaceEligibleUser } from "@/lib/organization/queries";
import { cn } from "@/lib/utils";

export type WorkflowChoice = "simple" | "manager_chain_finance" | "custom";

type Props = {
  value: WorkflowChoice;
  financeApproverUserIds: string[];
  eligibleUsers: WorkspaceEligibleUser[];
  disabled?: boolean;
  onChange: (value: WorkflowChoice) => void;
  onFinanceApproversChange: (userIds: string[]) => void;
};

function WorkflowOption({
  selected,
  title,
  description,
  disabled,
  onSelect,
  children,
}: {
  selected: boolean;
  title: string;
  description: string;
  disabled?: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border px-4 py-3 text-left transition-colors",
        selected ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/30",
        disabled && "opacity-60"
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      {selected ? children : null}
    </button>
  );
}

export function ApprovalWorkflowTemplatePicker({
  value,
  financeApproverUserIds,
  eligibleUsers,
  disabled = false,
  onChange,
  onFinanceApproversChange,
}: Props) {
  const [selectedFinanceUserId, setSelectedFinanceUserId] = useState("");

  const profileById = new Map(eligibleUsers.map((user) => [user.id, user]));
  const financeEligible = eligibleUsers.filter(
    (user) => !financeApproverUserIds.includes(user.id)
  );

  const addFinanceApprover = () => {
    if (!selectedFinanceUserId) return;
    onFinanceApproversChange([...financeApproverUserIds, selectedFinanceUserId]);
    setSelectedFinanceUserId("");
  };

  return (
    <div className="space-y-2">
      <WorkflowOption
        selected={value === "simple"}
        title="Simple — listed approvers"
        description="One approval step using your named approvers and roles."
        disabled={disabled}
        onSelect={() => onChange("simple")}
      />
      <WorkflowOption
        selected={value === "manager_chain_finance"}
        title="Manager chain + finance"
        description="Reporting manager, then skip-level manager and finance in parallel."
        disabled={disabled}
        onSelect={() => onChange("manager_chain_finance")}
      >
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            Requires{" "}
            <Link href={SETTINGS_ROUTES.access} className="text-primary hover:underline">
              reporting lines
            </Link>{" "}
            on the organization settings page.
          </p>
          <div className="space-y-2">
            <Label className="text-xs">Finance approvers</Label>
            <div className="flex flex-wrap gap-2">
              {financeApproverUserIds.length === 0 ? (
                <p className="text-xs text-muted-foreground">Add at least one finance approver.</p>
              ) : (
                financeApproverUserIds.map((userId) => {
                  const profile = profileById.get(userId);
                  const name = profile
                    ? `${profile.first_name} ${profile.last_name}`.trim()
                    : "Unknown";
                  return (
                    <Badge key={userId} variant="administrative">
                      {name}
                      {disabled ? null : (
                        <button
                          type="button"
                          className="ml-1 rounded-sm px-1 hover:bg-muted"
                          onClick={(event) => {
                            event.stopPropagation();
                            onFinanceApproversChange(
                              financeApproverUserIds.filter((id) => id !== userId)
                            );
                          }}
                        >
                          ×
                        </button>
                      )}
                    </Badge>
                  );
                })
              )}
            </div>
            {!disabled && financeEligible.length > 0 ? (
              <div className="flex flex-wrap items-end gap-2">
                <Select
                  value={selectedFinanceUserId || "none"}
                  onValueChange={(next) =>
                    setSelectedFinanceUserId(next === "none" ? "" : next)
                  }
                >
                  <SelectTrigger className="min-w-[200px]">
                    <SelectValue placeholder="Add finance approver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose person</SelectItem>
                    {financeEligible.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                  disabled={!selectedFinanceUserId}
                  onClick={(event) => {
                    event.stopPropagation();
                    addFinanceApprover();
                  }}
                >
                  Add
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </WorkflowOption>
      <WorkflowOption
        selected={value === "custom"}
        title="Custom multi-step"
        description="Build your own sequential approval steps."
        disabled={disabled}
        onSelect={() => onChange("custom")}
      />
    </div>
  );
}
