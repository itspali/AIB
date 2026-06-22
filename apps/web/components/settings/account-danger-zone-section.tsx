"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteMyAccount } from "@/app/settings/profile/actions";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Props = {
  email: string;
};

export function AccountDangerZoneSection({ email }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isPending, startTransition] = useTransition();

  const canDelete = confirmation.trim().toLowerCase() === email.trim().toLowerCase();

  const handleDelete = () => {
    if (!canDelete) return;

    startTransition(async () => {
      const result = await deleteMyAccount(confirmation.trim());
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      const supabase = createClient();
      await supabase.auth.signOut();

      toast.success("Account deleted");
      setOpen(false);
      setConfirmation("");
      router.push("/login");
    });
  };

  return (
    <OrgSettingsSection
      title="Danger zone"
      description="Permanently close your AIB sign-in and remove your profile."
    >
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <h4 className="text-sm font-medium text-destructive">Delete account</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Removes your user profile and signs you out. If you are the only member of a workspace,
          that workspace is deleted as well. Transfer ownership first when other team members remain.
        </p>
        <Button type="button" variant="destructive" className="mt-3" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </div>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setConfirmation("");
          setOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This permanently deletes your sign-in and profile. You will lose access to every
                  workspace where you are a member.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="account_delete_confirmation">
                    Type <span className="font-medium text-foreground">{email}</span> to confirm
                  </Label>
                  <Input
                    id="account_delete_confirmation"
                    type="email"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    placeholder={email}
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending || !canDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
            >
              {isPending ? "Deleting…" : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </OrgSettingsSection>
  );
}
