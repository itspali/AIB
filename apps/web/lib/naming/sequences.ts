import { z } from "zod";
import { NAMING_SEQUENCE_KEYS } from "@/lib/organization/naming-options";

export type NamingSequenceEntry = {
  prefix: string;
  digits: string;
};

export const namingSequenceEntrySchema = z.object({
  prefix: z.string().trim().max(32),
  digits: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d+$/.test(value), "Digits must be numeric")
    .refine((value) => {
      if (!value) return true;
      const parsed = Number(value);
      return parsed >= 3 && parsed <= 12;
    }, "Digits must be between 3 and 12"),
});

export const locationNamingSequencesSchema = z.record(z.string(), namingSequenceEntrySchema);

export function emptyNamingSequencesForm(): Record<string, NamingSequenceEntry> {
  return Object.fromEntries(
    NAMING_SEQUENCE_KEYS.map((key) => [key, { prefix: "", digits: "5" }])
  ) as Record<string, NamingSequenceEntry>;
}

export function parseNamingSequences(raw: unknown): Record<string, NamingSequenceEntry> {
  const base = emptyNamingSequencesForm();
  if (!raw || typeof raw !== "object") return base;

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    base[key] = {
      prefix: entry.prefix != null ? String(entry.prefix) : "",
      digits: entry.digits != null ? String(entry.digits) : "5",
    };
  }

  return base;
}

export function buildNamingSequencesPayload(
  raw: Record<string, NamingSequenceEntry>
): Record<string, { prefix: string; digits: number }> {
  const payload: Record<string, { prefix: string; digits: number }> = {};
  for (const [key, entry] of Object.entries(raw)) {
    const prefix = entry.prefix.trim();
    if (!prefix) continue;
    const digits = Number(entry.digits) || 5;
    payload[key] = { prefix, digits: Math.min(12, Math.max(3, digits)) };
  }
  return payload;
}

export function hasNamingOverrides(sequences: Record<string, NamingSequenceEntry>): boolean {
  return Object.values(sequences).some((entry) => entry.prefix.trim().length > 0);
}

export function namingOverrideSummary(
  sequences: Record<string, NamingSequenceEntry>
): Array<{ key: string; prefix: string; digits: string }> {
  return Object.entries(sequences)
    .filter(([, entry]) => entry.prefix.trim().length > 0)
    .map(([key, entry]) => ({
      key,
      prefix: entry.prefix.trim(),
      digits: entry.digits || "5",
    }));
}
