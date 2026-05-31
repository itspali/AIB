export const CURRENCY_OPTIONS = ["USD", "INR", "EUR", "GBP"] as const;
export type OrganizationCurrency = (typeof CURRENCY_OPTIONS)[number];

export const CURRENCY_LABELS: Record<OrganizationCurrency, string> = {
  USD: "US Dollar",
  INR: "Indian Rupee",
  EUR: "Euro",
  GBP: "British Pound",
};

export function currencyLabel(code: string): string {
  return CURRENCY_LABELS[code as OrganizationCurrency] ?? code;
}

export const FISCAL_MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
] as const;
