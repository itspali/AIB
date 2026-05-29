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

function getLocalDateParts(referenceDate: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(referenceDate);

  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value) - 1,
    day: Number(parts.find((p) => p.type === "day")?.value),
  };
}

function startOfWeekUtc(year: number, month: number, day: number): Date {
  const date = startOfDayUtc(year, month, day);
  const weekday = date.getUTCDay();
  const diff = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - diff);
  return date;
}

function endOfWeekUtc(start: Date): Date {
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return endOfDayUtc(end);
}

function quarterBounds(year: number, quarter: number): TemporalBounds {
  const startMonth = (quarter - 1) * 3;
  const start = startOfDayUtc(year, startMonth, 1);
  const lastDay = new Date(Date.UTC(year, startMonth + 3, 0)).getUTCDate();
  const end = endOfDayUtc(startOfDayUtc(year, startMonth + 2, lastDay));
  return { start: toUtcIso(start), end: toUtcIso(end) };
}

function yearBounds(year: number): TemporalBounds {
  const start = startOfDayUtc(year, 0, 1);
  const end = endOfDayUtc(startOfDayUtc(year, 11, 31));
  return { start: toUtcIso(start), end: toUtcIso(end) };
}

function monthBounds(year: number, month: number): TemporalBounds {
  const start = startOfDayUtc(year, month, 1);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const end = endOfDayUtc(startOfDayUtc(year, month, lastDay));
  return { start: toUtcIso(start), end: toUtcIso(end) };
}

export function parseRelativeTemporal(
  phrase: string,
  referenceDate: Date = new Date(),
  timezone = "UTC"
): TemporalBounds | null {
  const source = phrase.trim().toLowerCase();
  const { year, month, day } = getLocalDateParts(referenceDate, timezone);

  const firstWeekMatch = source.match(
    /(?:in|during)\s+the\s+first\s+week\s+of\s+([a-z]+)(?:\s+(\d{4}))?/
  );
  if (firstWeekMatch) {
    const monthIndex = resolveMonth(firstWeekMatch[1] ?? "");
    if (monthIndex === null) return null;
    const targetYear = firstWeekMatch[2] ? Number(firstWeekMatch[2]) : year;
    const start = startOfDayUtc(targetYear, monthIndex, 1);
    const end = endOfDayUtc(startOfDayUtc(targetYear, monthIndex, 7));
    return { start: toUtcIso(start), end: toUtcIso(end) };
  }

  const lastWeekMatch = source.match(
    /(?:in|during)\s+the\s+last\s+week\s+of\s+([a-z]+)(?:\s+(\d{4}))?/
  );
  if (lastWeekMatch) {
    const monthIndex = resolveMonth(lastWeekMatch[1] ?? "");
    if (monthIndex === null) return null;
    const targetYear = lastWeekMatch[2] ? Number(lastWeekMatch[2]) : year;
    const lastDay = new Date(Date.UTC(targetYear, monthIndex + 1, 0)).getUTCDate();
    const startDay = Math.max(1, lastDay - 6);
    const start = startOfDayUtc(targetYear, monthIndex, startDay);
    const end = endOfDayUtc(startOfDayUtc(targetYear, monthIndex, lastDay));
    return { start: toUtcIso(start), end: toUtcIso(end) };
  }

  const monthYearMatch = source.match(/(?:in|during)\s+([a-z]+)(?:\s+(\d{4}))?/);
  if (monthYearMatch) {
    const monthIndex = resolveMonth(monthYearMatch[1] ?? "");
    if (monthIndex === null) return null;
    const targetYear = monthYearMatch[2] ? Number(monthYearMatch[2]) : year;
    return monthBounds(targetYear, monthIndex);
  }

  let normalized = source;
  const embedded = normalized.match(/\b(?:in|during)\s+([a-z0-9\s]+)$/i);
  if (embedded?.[1]) {
    normalized = embedded[1].trim();
  }

  if (normalized === "today") {
    const start = startOfDayUtc(year, month, day);
    return { start: toUtcIso(start), end: toUtcIso(endOfDayUtc(start)) };
  }

  if (normalized === "yesterday") {
    const ref = startOfDayUtc(year, month, day);
    ref.setUTCDate(ref.getUTCDate() - 1);
    return { start: toUtcIso(ref), end: toUtcIso(endOfDayUtc(ref)) };
  }

  if (normalized === "this week" || normalized === "current week") {
    const start = startOfWeekUtc(year, month, day);
    return { start: toUtcIso(start), end: toUtcIso(endOfWeekUtc(start)) };
  }

  if (normalized === "last week") {
    const start = startOfWeekUtc(year, month, day);
    start.setUTCDate(start.getUTCDate() - 7);
    return { start: toUtcIso(start), end: toUtcIso(endOfWeekUtc(start)) };
  }

  if (normalized === "next week") {
    const start = startOfWeekUtc(year, month, day);
    start.setUTCDate(start.getUTCDate() + 7);
    return { start: toUtcIso(start), end: toUtcIso(endOfWeekUtc(start)) };
  }

  if (normalized === "this month" || normalized === "current month") {
    return monthBounds(year, month);
  }

  if (normalized === "last month") {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    return monthBounds(prevYear, prevMonth);
  }

  if (normalized === "this quarter") {
    const quarter = Math.floor(month / 3) + 1;
    return quarterBounds(year, quarter);
  }

  if (normalized === "last quarter") {
    const quarter = Math.floor(month / 3) + 1;
    if (quarter === 1) return quarterBounds(year - 1, 4);
    return quarterBounds(year, quarter - 1);
  }

  if (normalized === "this year") {
    return yearBounds(year);
  }

  if (normalized === "last year" || normalized === "previous year") {
    return yearBounds(year - 1);
  }

  if (normalized === "next year") {
    return yearBounds(year + 1);
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

export function parseCreatedInTemporal(
  clause: string,
  referenceDate?: Date,
  timezone?: string
): TemporalBounds | null {
  if (!/\bcreated\b/i.test(clause)) return null;
  return parseRelativeTemporal(clause, referenceDate, timezone);
}

export function parseIsoDateTime(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const start = startOfDayUtc(
      Number(trimmed.slice(0, 4)),
      Number(trimmed.slice(5, 7)) - 1,
      Number(trimmed.slice(8, 10))
    );
    return toUtcIso(start);
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function parseDateTimeBounds(
  value: string,
  referenceDate?: Date,
  timezone?: string
): TemporalBounds | string | null {
  const relative = parseRelativeTemporal(value, referenceDate, timezone);
  if (relative) return relative;
  return parseIsoDateTime(value);
}
