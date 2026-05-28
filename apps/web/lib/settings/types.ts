export type UiDensity = "DENSE" | "STANDARD";

export type AuthSessionRow = {
  id: string;
  os_browser: string;
  ip_address: string;
  last_activity_at: string;
  is_current: boolean;
};

export type ProfileSettingsSnapshot = {
  userId: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  avatar_url: string | null;
  timezone: string;
  ui_density: UiDensity;
  sessions: AuthSessionRow[];
  mfaEnabled: boolean;
};

export type ProfileSettingsFormValues = {
  first_name: string;
  last_name: string;
  phone_number: string;
  avatar_url: string;
  timezone: string;
  ui_density: UiDensity;
  current_password: string;
  new_password: string;
  confirm_password: string;
};

export function snapshotToFormValues(snapshot: ProfileSettingsSnapshot): ProfileSettingsFormValues {
  return {
    first_name: snapshot.first_name,
    last_name: snapshot.last_name,
    phone_number: snapshot.phone_number,
    avatar_url: snapshot.avatar_url ?? "",
    timezone: snapshot.timezone,
    ui_density: snapshot.ui_density,
    current_password: "",
    new_password: "",
    confirm_password: "",
  };
}
