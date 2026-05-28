export type UserRole = "OWNER" | "ADMIN" | "MANAGER" | "STAFF";

export type DutyStatus = "AVAILABLE" | "IN_MEETING" | "AWAY_ON_BREAK";

export type OperatorProfile = {
  userId: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl: string | null;
  tenantDisplayName: string;
  locationLabel: string;
  dutyStatus: DutyStatus;
  tenantMembershipCount: number;
};

export type ProfileFormValues = {
  first_name: string;
  last_name: string;
  phone_number: string;
  avatar_url: string;
};
