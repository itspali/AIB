import type { User } from "@supabase/supabase-js";
import { parseDutyStatus } from "@/lib/user/duty-status";
import type { OperatorProfile, UserRole } from "@/lib/user/types";

const VALID_ROLES = new Set<UserRole>(["OWNER", "ADMIN", "MANAGER", "STAFF"]);

function readRole(user: User): UserRole {
  const role = user.app_metadata?.role;
  return typeof role === "string" && VALID_ROLES.has(role as UserRole)
    ? (role as UserRole)
    : "OWNER";
}

function readName(user: User, field: "first_name" | "last_name"): string {
  const fromApp = user.app_metadata?.[field];
  if (typeof fromApp === "string" && fromApp.trim()) return fromApp.trim();

  const fromUser = user.user_metadata?.[field];
  if (typeof fromUser === "string" && fromUser.trim()) return fromUser.trim();

  return "";
}

export function buildFallbackOperatorProfile(
  user: User,
  tenantDisplayName = "Workspace"
): OperatorProfile {
  const role = readRole(user);
  const emailLocal = user.email?.split("@")[0] ?? "User";

  return {
    userId: user.id,
    firstName: readName(user, "first_name") || emailLocal,
    lastName: readName(user, "last_name"),
    role,
    avatarUrl:
      typeof user.user_metadata?.avatar_url === "string"
        ? user.user_metadata.avatar_url
        : null,
    tenantDisplayName,
    locationLabel: role === "OWNER" || role === "ADMIN" ? "All locations" : "Unassigned",
    dutyStatus: parseDutyStatus(user.user_metadata?.duty_status),
    tenantMembershipCount: 1,
  };
}
