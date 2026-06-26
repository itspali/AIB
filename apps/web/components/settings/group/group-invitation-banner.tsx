"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  acceptGroupInvitation,
  rejectGroupInvitation,
} from "@/app/settings/enterprise/actions";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dashboard/format";
import type { GroupInvitationRow } from "@/lib/group/types";

type Props = {
  invitations: GroupInvitationRow[];
};

export function GroupInvitationBanner({ invitations }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (invitations.length === 0) return null;

  return (
    <div className="space-y-3">
      {invitations.map((invitation) => (
        <div
          key={invitation.invitation_id}
          className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3"
        >
          <p className="text-sm font-medium">
            Invitation to join {invitation.group_name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {invitation.invited_by_name
              ? `Invited by ${invitation.invited_by_name}. `
              : null}
            Expires {formatDate(invitation.expires_at)}.
          </p>
          {invitation.message ? (
            <p className="mt-2 text-sm text-muted-foreground">&ldquo;{invitation.message}&rdquo;</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await acceptGroupInvitation(invitation.invitation_id);
                  if ("error" in result && result.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(`Joined ${invitation.group_name}`);
                  router.refresh();
                });
              }}
            >
              Accept invitation
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await rejectGroupInvitation(invitation.invitation_id);
                  if ("error" in result && result.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Invitation declined");
                  router.refresh();
                });
              }}
            >
              Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
