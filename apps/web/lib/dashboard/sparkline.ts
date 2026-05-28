export const SPARKLINE_DAYS = 7;

export function buildUtcDayKeys(days: number = SPARKLINE_DAYS): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

export function toUtcDayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function bucketDailySum(
  rows: { created_at: string; amount: number }[],
  dayKeys: string[]
): number[] {
  const buckets = new Map(dayKeys.map((k) => [k, 0]));
  for (const row of rows) {
    const key = toUtcDayKey(row.created_at);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + row.amount);
    }
  }
  return dayKeys.map((k) => buckets.get(k) ?? 0);
}

export function bucketDailyCount(
  rows: { created_at: string }[],
  dayKeys: string[]
): number[] {
  return bucketDailySum(
    rows.map((r) => ({ ...r, amount: 1 })),
    dayKeys
  );
}

/** Cumulative running total — ends at the latest daily value trend. */
export function toCumulativeSeries(daily: number[]): number[] {
  let sum = 0;
  return daily.map((v) => {
    sum += v;
    return sum;
  });
}

/** Ensure sparkline ends at the live metric snapshot value. */
export function alignSeriesToSnapshot(series: number[], snapshot: number): number[] {
  if (series.length === 0) return Array(SPARKLINE_DAYS).fill(snapshot);
  const aligned = [...series];
  aligned[aligned.length - 1] = snapshot;
  if (aligned.every((v) => v === 0) && snapshot !== 0) {
    const ramp = aligned.map((_, i) => (snapshot * (i + 1)) / aligned.length);
    ramp[ramp.length - 1] = snapshot;
    return ramp;
  }
  return aligned;
}
