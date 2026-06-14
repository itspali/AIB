"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  grantPoApprovalDelegate,
  revokePoApprovalDelegate,
} from "@/app/settings/organization/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { PoApprovalDelegateRow } from "@/lib/organization/types";

type EligibleUser = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

type Props = {
  delegates: PoApprovalDelegateRow[];
  eligibleDelegators: EligibleUser[];
  eligibleDelegates: EligibleUser[];
  canGrantDelegates: boolean;
};

export function PoApprovalDelegateSection({
  delegates,
  eligibleDelegators,
  eligibleDelegates,
  canGrantDelegates,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [delegatorUserId, setDelegatorUserId] = useState("");
  const [delegateUserId, setDelegateUserId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleGrant = () => {
    if (!delegatorUserId || !delegateUserId) {
      toast.error("Select both an approver and a delegate.");
      return;
    }

    startTransition(async () => {
      const result = await grantPoApprovalDelegate({
        delegator_user_id: delegatorUserId,
        delegate_user_id: delegateUserId,
        valid_until: validUntil.trim() ? new Date(validUntil).toISOString() : null,
      });
      if ("error" in result) {
        toast.error(result.error ?? "Unable to grant approval delegate.");
        return;
      }
      toast.success("Approval delegate granted.");
      setOpen(false);
      setDelegatorUserId("");
      setDelegateUserId("");
      setValidUntil("");
      router.refresh();
    });
  };

  const handleRevoke = (userId: string) => {
    startTransition(async () => {
      const result = await revokePoApprovalDelegate(userId);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to revoke approval delegate.");
        return;
      }
      toast.success("Approval delegate revoked.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {canGrantDelegates && (
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          Grant approval delegate
        </Button>
      )}

      {delegates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No approval delegates configured. Approvers can temporarily assign someone else to act on
          their pending approval steps.
        </p>
      ) : (
        <div className="surface-inset table-chrome-frame overflow-x-auto">
          <table
            data-header-tone="subtle"
            className="table-chrome w-full border-separate border-spacing-0 text-sm"
          >
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 font-medium text-muted-foreground">Approver</th>
                <th className="p-3 font-medium text-muted-foreground">Delegate</th>
                <th className="p-3 font-medium text-muted-foreground">Valid until</th>
                <th className="p-3 font-medium text-muted-foreground">Granted</th>
                {canGrantDelegates && (
                  <th className="p-3 font-medium text-muted-foreground">Action</th>
                )}
              </tr>
            </thead>
            <tbody>
              {delegates.map((delegate) => (
                <tr key={delegate.delegator_user_id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    {delegate.delegator_first_name} {delegate.delegator_last_name}
                    <p className="text-xs text-muted-foreground">{delegate.delegator_email}</p>
                  </td>
                  <td className="p-3">
                    {delegate.delegate_first_name} {delegate.delegate_last_name}
                    <p className="text-xs text-muted-foreground">{delegate.delegate_email}</p>
                  </td>
                  <td className="p-3">
                    {delegate.valid_until ? formatDate(delegate.valid_until) : "No expiry"}
                  </td>
                  <td className="p-3">{formatDate(delegate.granted_at)}</td>
                  {canGrantDelegates && (
                    <td className="p-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => handleRevoke(delegate.delegator_user_id)}
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
            <SheetTitle>Grant approval delegate</SheetTitle>
            <SheetDescription>
              When an approver is away, their delegate can approve or reject POs assigned to them.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Approver</Label>
              <Select
                value={delegatorUserId || "none"}
                onValueChange={(value) => setDelegatorUserId(value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select approver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select approver</SelectItem>
                  {eligibleDelegators.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name} — {user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Delegate</Label>
              <Select
                value={delegateUserId || "none"}
                onValueChange={(value) => setDelegateUserId(value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select delegate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select delegate</SelectItem>
                  {eligibleDelegates
                    .filter((user) => user.id !== delegatorUserId)
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name} {user.last_name} — {user.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="approval-delegate-until" className="text-sm font-medium text-muted-foreground">
                Valid until (optional)
              </Label>
              <Input
                id="approval-delegate-until"
                type="datetime-local"
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={isPending} onClick={handleGrant}>
                Grant delegate
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
