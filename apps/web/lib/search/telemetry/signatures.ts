export type SecurityScanResult = {
  flagged: boolean;
  reasons: string[];
};

const INJECTION_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bunion\b/i, reason: "sql_union" },
  { pattern: /\bselect\b.+\bfrom\b/i, reason: "sql_select" },
  { pattern: /--/, reason: "sql_comment" },
  { pattern: /;/, reason: "statement_terminator" },
  { pattern: /\bdrop\b/i, reason: "sql_drop" },
  { pattern: /\binsert\b/i, reason: "sql_insert" },
  { pattern: /\bdelete\b/i, reason: "sql_delete" },
];

const probeTracker = new Map<string, { tokens: Set<string>; windowStart: number }>();

const PROBE_WINDOW_MS = 5 * 60 * 1000;
const PROBE_TOKEN_LIMIT = 12;

export function scanQueryForSecuritySignatures(
  query: string,
  cacheKey?: string
): SecurityScanResult {
  const reasons: string[] = [];

  for (const { pattern, reason } of INJECTION_PATTERNS) {
    if (pattern.test(query)) reasons.push(reason);
  }

  if (cacheKey) {
    const now = Date.now();
    const entry = probeTracker.get(cacheKey) ?? { tokens: new Set<string>(), windowStart: now };
    if (now - entry.windowStart > PROBE_WINDOW_MS) {
      entry.tokens.clear();
      entry.windowStart = now;
    }
    query
      .split(/\s+/)
      .filter(Boolean)
      .forEach((token) => entry.tokens.add(token.toLowerCase()));
    probeTracker.set(cacheKey, entry);
    if (entry.tokens.size >= PROBE_TOKEN_LIMIT) {
      reasons.push("enumeration_probe");
    }
  }

  return { flagged: reasons.length > 0, reasons };
}

export function resetSecurityProbeTracker(cacheKey: string): void {
  probeTracker.delete(cacheKey);
}
