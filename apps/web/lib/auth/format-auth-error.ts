export function formatAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Auth rate limit reached. Wait about an hour, add SUPABASE_SERVICE_ROLE_KEY for dev signup, or sign in if you already registered.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "This email is already registered. Sign in instead, or use a different email.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please confirm your email using the link we sent, then sign in to continue setup.";
  }
  if (lower.includes("invalid login credentials")) {
    return "Incorrect email or password. Try again or reset your password.";
  }
  return message;
}
