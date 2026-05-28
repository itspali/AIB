"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UserProfileActions } from "@/components/layout/user-profile-actions";
import { UserProfileControls } from "@/components/layout/user-profile-controls";
import { UserProfileIdentity } from "@/components/layout/user-profile-identity";
import { UserProfileTrigger } from "@/components/layout/user-profile-trigger";
import type { DutyStatus, OperatorProfile } from "@/lib/user/types";

type Props = {
  profile: OperatorProfile;
  onOpenChange?: (open: boolean) => void;
};

export function UserProfileMenu({ profile, onOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const [dutyStatus, setDutyStatus] = useState<DutyStatus>(profile.dutyStatus);
  const containerRef = useRef<HTMLDivElement>(null);

  const fullName = `${profile.firstName} ${profile.lastName}`.trim() || "Account";

  const setMenuOpen = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  useEffect(() => {
    setDutyStatus(profile.dutyStatus);
  }, [profile.dutyStatus, profile.firstName, profile.lastName, profile.avatarUrl, profile.role]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, setMenuOpen]);

  const liveProfile = { ...profile, dutyStatus };

  return (
    <div ref={containerRef} className="relative">
      <UserProfileTrigger
        avatarUrl={profile.avatarUrl}
        fullName={fullName}
        open={open}
        onClick={() => setMenuOpen(!open)}
      />

      {open && (
        <div
          role="menu"
          aria-label="User profile menu"
          className="absolute right-0 z-50 mt-2 w-72 animate-in fade-in-50 slide-in-from-top-1 rounded-xl border border-border/80 bg-background p-2 shadow-lg duration-150 dark:border-white/10"
        >
          <UserProfileIdentity profile={liveProfile} />
          <div className="my-2 border-t border-border/80 dark:border-white/10" />
          <UserProfileControls profile={liveProfile} onDutyStatusChange={setDutyStatus} />
          <div className="my-2 border-t border-border/80 dark:border-white/10" />
          <UserProfileActions profile={liveProfile} onNavigate={() => setMenuOpen(false)} />
        </div>
      )}
    </div>
  );
}
