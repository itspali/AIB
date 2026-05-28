export function formatSessionActivity(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

export function parseUserAgentSummary(userAgent: string): string {
  if (!userAgent.trim()) return "Unknown device";

  let os = "Unknown OS";
  let browser = "Unknown browser";

  if (/Windows NT/i.test(userAgent)) os = "Windows";
  else if (/Mac OS X/i.test(userAgent)) os = "macOS";
  else if (/Android/i.test(userAgent)) os = "Android";
  else if (/iPhone|iPad/i.test(userAgent)) os = "iOS";
  else if (/Linux/i.test(userAgent)) os = "Linux";

  if (/Edg\//i.test(userAgent)) browser = "Edge";
  else if (/Chrome\//i.test(userAgent)) browser = "Chrome";
  else if (/Firefox\//i.test(userAgent)) browser = "Firefox";
  else if (/Safari\//i.test(userAgent)) browser = "Safari";

  return `${os} / ${browser}`;
}
