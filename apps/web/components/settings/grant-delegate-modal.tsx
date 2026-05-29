"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  grantOrganizationSettingsDelegate,
  revokeOrganizationSettingsDelegate,
} from "@/app/settings/organization/actions";
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
import { formatDate } from "@/lib/dashboard/format";
import type { OrganizationDelegateRow } from "@/lib/organization/types";

type EligibleUser = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

type Props = {
  delegates: OrganizationDelegateRow[];
  eligibleUsers: EligibleUser[];
  canGrantDelegates: boolean;
  showAdvanced: boolean;
};

export function GrantDelegateModalSection({
  delegates,
  eligibleUsers,
  canGrantDelegates,
  showAdvanced,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const handleGrant = () => {
    if (!selectedUserId) {
      toast.error("Select a workspace user to grant access.");
      return;
    }

    startTransition(async () => {
      const result = await grantOrganizationSettingsDelegate({ user_id: selectedUserId });
      if ("error" in result) {
        toast.error(result.error ?? "Unable to grant settings access.");
        return;
      }
      toast.success("Settings access delegate granted.");
      setOpen(false);
      setSelectedUserId("");
      router.refresh();
    });
  };

  const handleRevoke = (userId: string) => {
    startTransition(async () => {
      const result = await revokeOrganizationSettingsDelegate(userId);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to revoke settings access.");
        return;
      }
      toast.success("Settings access delegate revoked.");
      router.refresh();
    });
  };

  if (!showAdvanced) {
    return (
      <p className="text-sm text-muted-foreground">
        Enable advanced parameters to manage settings access delegates.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {canGrantDelegates && (
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          Grant Setting Access Delegate
        </Button>
      )}

      {delegates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No delegated administrators yet. Owners can grant edit access to active workspace users.
        </p>
      ) : (
        <div className="surface-inset overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="p-3 font-medium text-muted-foreground">Employee</th>
                <th className="p-3 font-medium text-muted-foreground">Work email</th>
                <th className="p-3 font-medium text-muted-foreground">Granted</th>
                {canGrantDelegates && (
                  <th className="p-3 font-medium text-muted-foreground">Action</th>
                )}
              </tr>
            </thead>
            <tbody>
              {delegates.map((delegate) => (
                <tr key={delegate.user_id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    {delegate.first_name} {delegate.last_name}
                  </td>
                  <td className="p-3">{delegate.email}</td>
                  <td className="p-3">{formatDate(delegate.granted_at)}</td>
                  {canGrantDelegates && (
                    <td className="p-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => handleRevoke(delegate.user_id)}
                      >
                        Revoke
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Grant Setting Access Delegate</SheetTitle>
            <SheetDescription>
              Grant edit access to organization settings for an active workspace user.
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
                  {eligibleUsers.map((user) => (
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
              <Button type="button" disabled={isPending} onClick={handleGrant}>
                Grant access
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
