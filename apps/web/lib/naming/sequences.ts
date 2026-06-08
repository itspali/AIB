import { z } from "zod";
import {
  defaultDocumentNamingPrefix,
  NAMING_SEQUENCE_KEYS,
  type NamingSequenceKey,
} from "@/lib/organization/naming-options";

export type NamingSequenceEntry = {
  prefix: string;
  digits: string;
  next?: string;
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
  next: z
    .string()
    .trim()
    .optional()
    .refine((value) => value === undefined || value === "" || /^\d+$/.test(value), {
      message: "Next value must be numeric",
    })
    .refine((value) => {
      if (!value) return true;
      return Number(value) >= 1;
    }, "Next value must be at least 1"),
});

export const locationNamingSequencesSchema = z.record(z.string(), namingSequenceEntrySchema);

export function emptyNamingSequencesForm(
  keys: readonly string[] = NAMING_SEQUENCE_KEYS,
  year: number = new Date().getFullYear()
): Record<string, NamingSequenceEntry> {
  return Object.fromEntries(
    keys.map((key) => {
      const isDocumentKey = (NAMING_SEQUENCE_KEYS as readonly string[]).includes(key);
      const prefix = isDocumentKey
        ? defaultDocumentNamingPrefix(key as NamingSequenceKey, year)
        : "";
      return [key, { prefix, digits: "5", next: prefix ? "1" : "" }];
    })
  ) as Record<string, NamingSequenceEntry>;
}

export function parseNamingSequences(
  raw: unknown,
  keys: readonly string[] = NAMING_SEQUENCE_KEYS,
  year: number = new Date().getFullYear()
): Record<string, NamingSequenceEntry> {
  const base = emptyNamingSequencesForm(keys, year);
  if (!raw || typeof raw !== "object") return base;

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!keys.includes(key)) continue;
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const storedPrefix = entry.prefix != null ? String(entry.prefix).trim() : "";
    const isDocumentKey = (NAMING_SEQUENCE_KEYS as readonly string[]).includes(key);
    const fallbackPrefix = isDocumentKey
      ? defaultDocumentNamingPrefix(key as NamingSequenceKey, year)
      : "";
    const prefix = storedPrefix || fallbackPrefix;
    base[key] = {
      prefix,
      digits: entry.digits != null ? String(entry.digits) : "5",
      next:
        entry.next != null
          ? String(entry.next)
          : entry.current != null
            ? String(entry.current)
            : prefix
              ? "1"
              : "",
    };
  }

  return base;
}

export function buildNamingSequencesPayload(
  raw: Record<string, NamingSequenceEntry>
): Record<string, { prefix: string; digits: number; next?: number }> {
  const payload: Record<string, { prefix: string; digits: number; next?: number }> = {};
  for (const [key, entry] of Object.entries(raw)) {
    const prefix = entry.prefix.trim();
    if (!prefix) continue;
    const digits = Number(entry.digits) || 5;
    const nextRaw = entry.next?.trim() ?? "";
    const next = nextRaw ? Number(nextRaw) : undefined;
    payload[key] = {
      prefix,
      digits: Math.min(12, Math.max(3, digits)),
      ...(next != null && Number.isFinite(next) && next >= 1 ? { next } : {}),
    };
  }
  return payload;
}

export function hasNamingOverrides(sequences: Record<string, NamingSequenceEntry>): boolean {
  return Object.values(sequences).some((entry) => entry.prefix.trim().length > 0);
}

export function namingOverrideSummary(
  sequences: Record<string, NamingSequenceEntry>,
  keys?: readonly string[]
): Array<{ key: string; prefix: string; digits: string }> {
  const allowed = keys ? new Set(keys) : null;
  return Object.entries(sequences)
    .filter(([key, entry]) => {
      if (allowed && !allowed.has(key)) return false;
      return entry.prefix.trim().length > 0;
    })
    .map(([key, entry]) => ({
      key,
      prefix: entry.prefix.trim(),
      digits: entry.digits || "5",
    }));
}
