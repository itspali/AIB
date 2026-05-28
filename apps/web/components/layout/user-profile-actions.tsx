"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, LogOut, Settings, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { OperatorProfile } from "@/lib/user/types";

type Props = {
  profile: OperatorProfile;
  onNavigate: () => void;
};

const rowClassName =
  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors duration-200 hover:bg-accent hover:text-foreground";

export function UserProfileActions({ profile, onNavigate }: Props) {
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
      <Link href="/settings/profile" className={rowClassName} onClick={onNavigate}>
        <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
        Account Settings &amp; Security
      </Link>

      <Link href="/settings/organization" className={rowClassName} onClick={onNavigate}>
        <Settings2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        Organization Settings
      </Link>

      {showWorkspaceSwitch && (
        <button type="button" className={rowClassName} onClick={onNavigate}>
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          Switch Workspace Instance
        </button>
      )}

      <div className="my-1 border-t border-border" />

      <button
        type="button"
        disabled={isPending}
        onClick={handleSignOut}
        className={cn(
          rowClassName,
          "text-destructive/90 hover:bg-destructive/10 hover:text-destructive"
        )}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        Sign Out / Terminate Session
      </button>
    </div>
  );
}
