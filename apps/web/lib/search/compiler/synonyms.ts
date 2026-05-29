import type { ResolvedFieldDictEntry } from "@/lib/search/types";

export type SynonymMatch = {
  field: string;
  synonym: string;
};

export function flattenSynonyms(fieldDict: ResolvedFieldDictEntry[]): SynonymMatch[] {
  const matches: SynonymMatch[] = [];
  for (const entry of fieldDict) {
    for (const synonym of entry.synonyms) {
      matches.push({ field: entry.key, synonym: synonym.toLowerCase() });
    }
  }
  return matches.sort((a, b) => b.synonym.length - a.synonym.length);
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildSynonymAlternation(fieldDict: ResolvedFieldDictEntry[]): string {
  const synonyms = flattenSynonyms(fieldDict).map((entry) => escapeRegex(entry.synonym));
  if (!synonyms.length) return "";
  return synonyms.join("|");
}

export function resolveSynonymField(
  text: string,
  fieldDict: ResolvedFieldDictEntry[]
): string | null {
  const normalized = text.trim().toLowerCase();
  for (const entry of flattenSynonyms(fieldDict)) {
    if (normalized === entry.synonym) return entry.field;
  }
  return null;
}

export function resolveSynonymFieldsInPhrase(
  phrase: string,
  fieldDict: ResolvedFieldDictEntry[]
): { field: string; remainder: string } | null {
  const normalized = phrase.trim().toLowerCase();
  for (const entry of flattenSynonyms(fieldDict)) {
    if (normalized.startsWith(entry.synonym)) {
      return {
        field: entry.field,
        remainder: normalized.slice(entry.synonym.length).trim(),
      };
    }
  }
  return null;
}
