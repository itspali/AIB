export const CREDIT_CONTROL_OPTIONS = ["STRICT", "WARN", "OFF"] as const;
export type CreditControlEnforcement = (typeof CREDIT_CONTROL_OPTIONS)[number];

export function creditControlLabel(value: CreditControlEnforcement): string {
  switch (value) {
    case "STRICT":
      return "Strict enforcement";
    case "WARN":
      return "Warn only";
    case "OFF":
      return "Disabled";
    default:
      return value;
  }
}
