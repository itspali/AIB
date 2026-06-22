import type { AppConsoleRole } from "./types";

const ROLE_RANK: Record<AppConsoleRole, number> = {
  VIEWER: 1,
  OPERATOR: 2,
  ADMIN: 3,
};

export function roleAtLeast(actual: AppConsoleRole, minimum: AppConsoleRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[minimum];
}

export function roleLabel(role: AppConsoleRole): string {
  return role;
}
