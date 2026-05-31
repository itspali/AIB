export const LOCALE_OPTIONS = [
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-IN", label: "English (India)" },
  { value: "en-AU", label: "English (Australia)" },
  { value: "en-CA", label: "English (Canada)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "fr-CA", label: "French (Canada)" },
  { value: "de-DE", label: "German (Germany)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "ja-JP", label: "Japanese (Japan)" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "ar-AE", label: "Arabic (United Arab Emirates)" },
] as const;

export const LOCALE_VALUES = LOCALE_OPTIONS.map((option) => option.value);

export type OrganizationLocale = (typeof LOCALE_OPTIONS)[number]["value"];

export function localeLabel(value: string): string {
  return LOCALE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
