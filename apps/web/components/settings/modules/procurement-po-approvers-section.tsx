"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  PO_APPROVER_ROLE_OPTIONS,
  type ApproverRoleOption,
  type PoApproverRole,
} from "@/lib/approvals/approval-rules";

export type WorkspaceUserOption = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

type Props = {
  approverUserIds: string[];
  approverRoles: PoApproverRole[];
  approverProfiles: WorkspaceUserOption[];
  eligibleUsers: WorkspaceUserOption[];
  roleOptions?: readonly ApproverRoleOption[];
  canEdit: boolean;
  onChangeUsers: (approverUserIds: string[]) => void;
  onChangeRoles: (approverRoles: PoApproverRole[]) => void;
};

export function ProcurementPoApproversSection({
  approverUserIds,
  approverRoles,
  approverProfiles,
  eligibleUsers,
  roleOptions = PO_APPROVER_ROLE_OPTIONS,
  canEdit,
  onChangeUsers,
  onChangeRoles,
}: Props) {
  const [selectedUserId, setSelectedUserId] = useState("");

  const profileById = new Map(approverProfiles.map((user) => [user.id, user]));
  const eligibleToGrant = eligibleUsers.filter((user) => !approverUserIds.includes(user.id));

  const handleAdd = () => {
    if (!selectedUserId) return;
    onChangeUsers([...approverUserIds, selectedUserId]);
    setSelectedUserId("");
  };

  const toggleRole = (role: PoApproverRole, checked: boolean) => {
    if (checked) {
      onChangeRoles([...new Set([...approverRoles, role])]);
      return;
    }
    onChangeRoles(approverRoles.filter((entry) => entry !== role));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Workspace owners can always approve. Add roles and/or specific people below.
      </p>

      <div className="space-y-2">
        <Label className="text-xs">Roles that can approve</Label>
        <div className="space-y-2">
          {roleOptions.map((option) => (
            <div
              key={option.role}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div>
                <p className="text-sm">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
              <Switch
                checked={approverRoles.includes(option.role)}
                disabled={!canEdit}
                onCheckedChange={(checked) => toggleRole(option.role, checked)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Named approvers</Label>
        <div className="flex flex-wrap gap-2">
          {approverUserIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No named approvers added.</p>
          ) : (
            approverUserIds.map((userId) => {
              const profile = profileById.get(userId);
              const name = profile
                ? `${profile.first_name} ${profile.last_name}`.trim()
                : "Unknown user";
              return (
                <Badge key={userId} variant="administrative" className="gap-1 pr-1">
                  {name}
                  {canEdit ? (
                    <button
                      type="button"
                      className="rounded-sm p-0.5 hover:bg-muted"
                      aria-label={`Remove ${name}`}
                      onClick={() =>
                        onChangeUsers(approverUserIds.filter((id) => id !== userId))
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                </Badge>
              );
            })
          )}
        </div>

        {canEdit && eligibleToGrant.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1 space-y-1">
              <Select
                value={selectedUserId || "none"}
                onValueChange={(value) => setSelectedUserId(value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choose a person</SelectItem>
                  {eligibleToGrant.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!selectedUserId}
              onClick={handleAdd}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
