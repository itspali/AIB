export type GroupMembershipRole = "GROUP_OWNER" | "GROUP_ADMIN" | "GROUP_VIEWER";

export type TenantGroupMembershipStatus =
  | "ACTIVE"
  | "SUSPENDED"
  | "EXIT_PENDING"
  | "EXITED"
  | "DECOMMISSIONED";

export type GroupOrganizationRow = {
  tenant_id: string;
  organization_code: string;
  name: string;
  trade_name: string | null;
  membership_status: TenantGroupMembershipStatus;
  tenant_status: string;
  onboarding_status: string;
  member_count: number;
  joined_at: string;
};

export type GroupSettingsSnapshot = {
  group_id: string;
  group_code: string;
  name: string;
  legal_name: string | null;
  trade_name: string | null;
  primary_email: string;
  primary_phone: string;
  status: string;
  is_active: boolean;
  organizations: GroupOrganizationRow[];
};

export type GroupSettingsAccess = {
  granted: boolean;
  role: GroupMembershipRole | null;
  isOwner: boolean;
  isAdmin: boolean;
};

export type GroupSettingsFormValues = {
  name: string;
  legal_name: string;
  trade_name: string;
  primary_email: string;
  primary_phone: string;
};

export type GroupInvitationRow = {
  invitation_id: string;
  group_id: string;
  group_name: string;
  message: string | null;
  invited_by_name: string | null;
  expires_at: string;
  created_at: string;
};

export type GroupOutboundInvitationRow = {
  invitation_id: string;
  tenant_id: string;
  organization_name: string;
  message: string | null;
  expires_at: string;
  created_at: string;
};

export function snapshotToGroupFormValues(
  snapshot: GroupSettingsSnapshot
): GroupSettingsFormValues {
  return {
    name: snapshot.name,
    legal_name: snapshot.legal_name ?? "",
    trade_name: snapshot.trade_name ?? "",
    primary_email: snapshot.primary_email,
    primary_phone: snapshot.primary_phone,
  };
}
