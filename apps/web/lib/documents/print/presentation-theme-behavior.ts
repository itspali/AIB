import type { PresentationLayoutTheme } from "@/lib/documents/print/types";

const TITLE_BLOCK_METADATA_THEMES = new Set<PresentationLayoutTheme>([
  "trade",
  "classic",
  "retail",
]);

const PARTY_BLOCK_THEMES = new Set<PresentationLayoutTheme>([
  "trade",
  "classic",
  "modern",
]);

const AMOUNT_IN_WORDS_THEMES = new Set<PresentationLayoutTheme>([
  "trade",
  "classic",
  "formal",
]);

const CLOSING_MESSAGE_THEMES = new Set<PresentationLayoutTheme>(["trade", "retail", "branded"]);

export function themeUsesTitleBlockMetadata(theme: PresentationLayoutTheme): boolean {
  return TITLE_BLOCK_METADATA_THEMES.has(theme);
}

export function themeShowsPartyBlocks(theme: PresentationLayoutTheme): boolean {
  return PARTY_BLOCK_THEMES.has(theme);
}

export function themeShowsAmountInWords(theme: PresentationLayoutTheme): boolean {
  return AMOUNT_IN_WORDS_THEMES.has(theme);
}

export function themeShowsClosingMessage(theme: PresentationLayoutTheme): boolean {
  return CLOSING_MESSAGE_THEMES.has(theme);
}

export function defaultClosingMessage(theme: PresentationLayoutTheme, orgName: string): string | null {
  if (!themeShowsClosingMessage(theme)) return null;
  if (theme === "branded") return "Thank you for your business!";
  return `Thank you for your business!\n${orgName}`;
}
