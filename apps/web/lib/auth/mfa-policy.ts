import "server-only";

export function isConsoleMfaOptional(): boolean {
  const optional = process.env.APP_CONSOLE_MFA_OPTIONAL === "true";
  if (optional && process.env.NODE_ENV === "production") {
    console.warn(
      "[security] APP_CONSOLE_MFA_OPTIONAL=true disables console MFA in production. Remove this env var.",
    );
  }
  return optional;
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
