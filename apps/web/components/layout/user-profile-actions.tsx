"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, LogOut, Settings } from "lucide-react";
import { ProfileNavLink, rowClassName } from "@/components/layout/profile-nav-link";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { OperatorProfile } from "@/lib/user/types";

type Props = {
  profile: OperatorProfile;
  onboardingOnly?: boolean;
  onNavigate: () => void;
};

export function UserProfileActions({ profile, onboardingOnly = false, onNavigate }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const showWorkspaceSwitch = profile.tenantMembershipCount > 1;

  const handleSignOut = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      onNavigate();
      router.push("/login");
      router.refresh();
    });
  };

  return (
    <div className="space-y-0.5 px-1 pb-1">
      {!onboardingOnly ? (
        <>
          <ProfileNavLink href="/settings/profile" icon={Settings} onNavigate={onNavigate}>
            Account Settings &amp; Security
          </ProfileNavLink>

          {showWorkspaceSwitch && (
            <button type="button" className={rowClassName} onClick={onNavigate}>
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              Switch Workspace Instance
            </button>
          )}

          <div className="my-1 border-t border-border" />
        </>
      ) : null}

      <button
        type="button"
        disabled={isPending}
        onClick={handleSignOut}
        className={cn(
          rowClassName,
          "text-destructive/90 hover:bg-destructive/10 hover:text-destructive"
        )}
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden />
        {isPending ? "Signing out…" : "Sign Out / Terminate Session"}
      </button>
    </div>
  );
}
