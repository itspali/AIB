import type { DutyStatus } from "@/lib/user/types";

export const DUTY_STATUS_OPTIONS: { value: DutyStatus; label: string }[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "IN_MEETING", label: "In a Meeting" },
  { value: "AWAY_ON_BREAK", label: "Away on Break" },
];

const VALID_STATUSES = new Set<string>(DUTY_STATUS_OPTIONS.map((o) => o.value));

export function parseDutyStatus(raw: unknown): DutyStatus {
  const value = String(raw ?? "AVAILABLE");
  return VALID_STATUSES.has(value) ? (value as DutyStatus) : "AVAILABLE";
}

export function dutyStatusLabel(status: DutyStatus): string {
  return DUTY_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "Available";
}
