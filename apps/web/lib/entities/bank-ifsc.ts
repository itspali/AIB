export type IfscLookupResult = {
  bank: string;
  branch: string;
  bankCode: string;
  ifsc: string;
};

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** First four characters of a valid IFSC identify the bank (RBI convention). */
export function extractBankCodeFromIfsc(ifsc: string): string | null {
  const normalized = ifsc.trim().toUpperCase();
  if (!IFSC_PATTERN.test(normalized)) return null;
  return normalized.slice(0, 4);
}

/**
 * Razorpay hosts bank logos keyed by 4-letter bank code (same code embedded in IFSC).
 * Logo URL is derived client-side and refreshed whenever IFSC / bank_code changes.
 */
export function resolveBankLogoUrl(bankCode: string | null | undefined): string | null {
  const code = bankCode?.trim().toUpperCase();
  if (!code || code.length !== 4) return null;
  return `https://cdn.razorpay.com/static/assets/img/bank/${code}.png`;
}

export async function lookupIfscDetails(ifsc: string): Promise<IfscLookupResult | null> {
  const normalized = ifsc.trim().toUpperCase();
  if (!IFSC_PATTERN.test(normalized)) return null;

  try {
    const response = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(normalized)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      BANK?: string;
      BRANCH?: string;
      BANKCODE?: string;
      IFSC?: string;
    };

    const bankCode =
      payload.BANKCODE?.trim().toUpperCase() || extractBankCodeFromIfsc(normalized) || "";
    if (!bankCode) return null;

    return {
      bank: payload.BANK?.trim() ?? "",
      branch: payload.BRANCH?.trim() ?? "",
      bankCode,
      ifsc: payload.IFSC?.trim().toUpperCase() ?? normalized,
    };
  } catch {
    return null;
  }
}

export function isValidUpiId(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^[\w.\-]{2,256}@[\w.\-]{2,64}$/i.test(trimmed);
}

export function normalizeUpiId(value: string): string {
  return value.trim().toLowerCase();
}
