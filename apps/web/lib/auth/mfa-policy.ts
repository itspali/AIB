import "server-only";

export function isConsoleMfaOptional(): boolean {
  return process.env.APP_CONSOLE_MFA_OPTIONAL === "true";
}

export function readAalFromClaims(claims: Record<string, unknown> | undefined): "aal1" | "aal2" | null {
  const aal = claims?.aal;
  if (aal === "aal2") return "aal2";
  if (aal === "aal1") return "aal1";
  return null;
}

export function sessionSatisfiesConsoleMfa(
  aal: "aal1" | "aal2" | null,
  mfaRequired: boolean,
  operatorMfaEnforced: boolean
): boolean {
  if (!mfaRequired || !operatorMfaEnforced || isConsoleMfaOptional()) return true;
  return aal === "aal2";
}
