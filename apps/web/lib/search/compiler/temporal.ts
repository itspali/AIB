export type TemporalBounds = {
  start: string;
  end: string;
};

const MONTH_NAMES: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

function toUtcIso(date: Date): string {
  return date.toISOString();
}

function endOfDayUtc(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)
  );
}

function startOfDayUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

function resolveMonth(name: string): number | null {
  return MONTH_NAMES[name.toLowerCase()] ?? null;
}

export function parseRelativeTemporal(
  clause: string,
  referenceDate: Date = new Date(),
  timezone = "UTC"
): TemporalBounds | null {
  const normalized = clause.trim().toLowerCase();

  if (/\btoday\b/.test(normalized)) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(referenceDate);
    const year = Number(parts.find((p) => p.type === "year")?.value);
    const month = Number(parts.find((p) => p.type === "month")?.value) - 1;
    const day = Number(parts.find((p) => p.type === "day")?.value);
    const start = startOfDayUtc(year, month, day);
    return { start: toUtcIso(start), end: toUtcIso(endOfDayUtc(start)) };
  }

  const firstWeekMatch = normalized.match(
    /(?:in|during)\s+the\s+first\s+week\s+of\s+([a-z]+)(?:\s+(\d{4}))?/
  );
  if (firstWeekMatch) {
    const month = resolveMonth(firstWeekMatch[1] ?? "");
    if (month === null) return null;
    const year = firstWeekMatch[2] ? Number(firstWeekMatch[2]) : referenceDate.getUTCFullYear();
    const start = startOfDayUtc(year, month, 1);
    const end = endOfDayUtc(startOfDayUtc(year, month, 7));
    return { start: toUtcIso(start), end: toUtcIso(end) };
  }

  const lastWeekMatch = normalized.match(
    /(?:in|during)\s+the\s+last\s+week\s+of\s+([a-z]+)(?:\s+(\d{4}))?/
  );
  if (lastWeekMatch) {
    const month = resolveMonth(lastWeekMatch[1] ?? "");
    if (month === null) return null;
    const year = lastWeekMatch[2] ? Number(lastWeekMatch[2]) : referenceDate.getUTCFullYear();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const startDay = Math.max(1, lastDay - 6);
    const start = startOfDayUtc(year, month, startDay);
    const end = endOfDayUtc(startOfDayUtc(year, month, lastDay));
    return { start: toUtcIso(start), end: toUtcIso(end) };
  }

  const monthYearMatch = normalized.match(/(?:in|during)\s+([a-z]+)(?:\s+(\d{4}))?/);
  if (monthYearMatch) {
    const month = resolveMonth(monthYearMatch[1] ?? "");
    if (month === null) return null;
    const year = monthYearMatch[2] ? Number(monthYearMatch[2]) : referenceDate.getUTCFullYear();
    const start = startOfDayUtc(year, month, 1);
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const end = endOfDayUtc(startOfDayUtc(year, month, lastDay));
    return { start: toUtcIso(start), end: toUtcIso(end) };
  }

  return null;
}

export function parseCreatedAfterDate(clause: string): string | null {
  const match = clause.match(/created\s+(?:after|since|from)\s+(\d{4}-\d{2}-\d{2})/i);
  if (!match?.[1]) return null;
  const start = startOfDayUtc(
    Number(match[1].slice(0, 4)),
    Number(match[1].slice(5, 7)) - 1,
    Number(match[1].slice(8, 10))
  );
  return toUtcIso(start);
}

export function parseCreatedInTemporal(clause: string, referenceDate?: Date, timezone?: string): TemporalBounds | null {
  if (!/\bcreated\b/i.test(clause)) return null;
  return parseRelativeTemporal(clause, referenceDate, timezone);
}
