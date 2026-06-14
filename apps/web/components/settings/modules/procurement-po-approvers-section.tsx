"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type WorkspaceUserOption = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

type Props = {
  approverUserIds: string[];
  approverProfiles: WorkspaceUserOption[];
  eligibleUsers: WorkspaceUserOption[];
  canEdit: boolean;
  onChange: (approverUserIds: string[]) => void;
};

export function ProcurementPoApproversSection({
  approverUserIds,
  approverProfiles,
  eligibleUsers,
  canEdit,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  const profileById = new Map(approverProfiles.map((user) => [user.id, user]));
  const eligibleToGrant = eligibleUsers.filter((user) => !approverUserIds.includes(user.id));

  const handleGrant = () => {
    if (!selectedUserId) return;
    onChange([...approverUserIds, selectedUserId]);
    setOpen(false);
    setSelectedUserId("");
  };

  const handleRevoke = (userId: string) => {
    onChange(approverUserIds.filter((id) => id !== userId));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Workspace owners can always approve. Add named approvers below to delegate approval without
        owner access.
      </p>

      {canEdit ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          Grant approver
        </Button>
      ) : null}

      {approverUserIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No named approvers configured. Only workspace owners can approve purchase orders.
        </p>
      ) : (
        <div className="surface-inset table-chrome-frame overflow-x-auto">
          <table
            data-header-tone="subtle"
            className="table-chrome w-full border-separate border-spacing-0 text-sm"
          >
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 font-medium text-muted-foreground">Name</th>
                <th className="p-3 font-medium text-muted-foreground">Email</th>
                {canEdit ? (
                  <th className="p-3 font-medium text-muted-foreground">Action</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {approverUserIds.map((userId) => {
                const profile = profileById.get(userId);
                return (
                  <tr key={userId} className="border-b border-border last:border-0">
                    <td className="p-3">
                      {profile
                        ? `${profile.first_name} ${profile.last_name}`.trim()
                        : "Unknown user"}
                    </td>
                    <td className="p-3">{profile?.email ?? "—"}</td>
                    {canEdit ? (
                      <td className="p-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevoke(userId)}
                        >
                          Revoke
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Grant purchase order approver</SheetTitle>
            <SheetDescription>
              Allow an active workspace user to approve purchase orders before issue.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Workspace user</Label>
              <Select
                value={selectedUserId || "none"}
                onValueChange={(value) => setSelectedUserId(value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select user</SelectItem>
                  {eligibleToGrant.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name} — {user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={!selectedUserId} onClick={handleGrant}>
                Grant approver
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
