"use client";

import { MapPin } from "lucide-react";
import { roleBadgeClassName, roleBadgeLabel } from "@/lib/user/role-badge";
import type { OperatorProfile } from "@/lib/user/types";

type Props = {
  profile: OperatorProfile;
};

export function UserProfileIdentity({ profile }: Props) {
  const fullName = `${profile.firstName} ${profile.lastName}`.trim() || "Operator";

  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="font-bold text-foreground">{fullName}</p>
      <div className="mt-2">
        <span className={roleBadgeClassName(profile.role)}>{roleBadgeLabel(profile.role)}</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{profile.tenantDisplayName}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {profile.locationLabel}
      </p>
    </div>
  );
}
