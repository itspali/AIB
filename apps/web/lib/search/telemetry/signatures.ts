export type SecurityScanResult = {
  flagged: boolean;
  reasons: string[];
  /** True when the session should be restricted to text search only. */
  shouldThrottle: boolean;
};

const INJECTION_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bunion\b/i, reason: "sql_union" },
  { pattern: /\bselect\b.+\bfrom\b/i, reason: "sql_select" },
  { pattern: /--/, reason: "sql_comment" },
  { pattern: /\bdrop\b/i, reason: "sql_drop" },
  { pattern: /\binsert\b/i, reason: "sql_insert" },
  { pattern: /\bdelete\b/i, reason: "sql_delete" },
];

/** Tokens common in native filter queries — excluded from enumeration heuristics. */
const FILTER_VOCABULARY = new Set([
  "a",
  "and",
  "active",
  "after",
  "at",
  "before",
  "between",
  "books",
  "category",
  "city",
  "code",
  "contains",
  "created",
  "current",
  "date",
  "does",
  "during",
  "empty",
  "equal",
  "finished",
  "from",
  "good",
  "greater",
  "having",
  "hsn",
  "in",
  "inactive",
  "includes",
  "is",
  "item",
  "items",
  "last",
  "least",
  "less",
  "like",
  "location",
  "material",
  "month",
  "more",
  "name",
  "next",
  "not",
  "number",
  "of",
  "on",
  "one",
  "or",
  "physical",
  "previous",
  "price",
  "purchase",
  "quarter",
  "raw",
  "retail",
  "sac",
  "sales",
  "selling",
  "service",
  "sku",
  "starts",
  "status",
  "than",
  "the",
  "this",
  "today",
  "type",
  "uom",
  "unit",
  "until",
  "week",
  "where",
  "whose",
  "with",
  "within",
  "work",
  "year",
  "yesterday",
  "zero",
  "is",
  "at",
  "most",
  "progress",
  "bundle",
  "kit",
  "overhead",
  "measure",
  "base",
  "default",
  "electronics",
  "pieces",
  "kilograms",
  "liters",
  "meters",
  "boxes",
  "warehouse",
  "office",
  "head",
  "outlet",
  "plant",
  "global",
  "hq",
]);

const probeTracker = new Map<string, { tokens: Set<string>; windowStart: number }>();

const PROBE_WINDOW_MS = 5 * 60 * 1000;
/** Unique non-vocabulary tokens allowed before logging an enumeration probe. */
const PROBE_TOKEN_LIMIT = 24;

const THROTTLE_REASONS = new Set([
  "sql_union",
  "sql_select",
  "sql_comment",
  "sql_drop",
  "sql_insert",
  "sql_delete",
]);

function isProbeToken(token: string): boolean {
  const normalized = token.toLowerCase();
  if (normalized.length <= 1) return false;
  if (FILTER_VOCABULARY.has(normalized)) return false;
  if (/^[\d,]+(?:\.\d+)?$/.test(normalized)) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) return false;
  return true;
}

export function shouldThrottleSearchSession(reasons: string[]): boolean {
  return reasons.some((reason) => THROTTLE_REASONS.has(reason));
}

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
      .forEach((token) => {
        if (isProbeToken(token)) {
          entry.tokens.add(token.toLowerCase());
        }
      });
    probeTracker.set(cacheKey, entry);
    if (entry.tokens.size >= PROBE_TOKEN_LIMIT) {
      reasons.push("enumeration_probe");
    }
  }

  return {
    flagged: reasons.length > 0,
    reasons,
    shouldThrottle: shouldThrottleSearchSession(reasons),
  };
}

export function resetSecurityProbeTracker(cacheKey: string): void {
  probeTracker.delete(cacheKey);
}
