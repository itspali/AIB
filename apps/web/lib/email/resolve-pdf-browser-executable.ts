import fs from "node:fs";

const WINDOWS_BROWSER_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const MAC_BROWSER_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

const LINUX_BROWSER_CANDIDATES = [
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

function firstExistingPath(candidates: string[]): string | null {
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // Ignore permission or path errors.
    }
  }
  return null;
}

export function detectLocalBrowserExecutable(): string | null {
  switch (process.platform) {
    case "win32":
      return firstExistingPath(WINDOWS_BROWSER_CANDIDATES);
    case "darwin":
      return firstExistingPath(MAC_BROWSER_CANDIDATES);
    default:
      return firstExistingPath(LINUX_BROWSER_CANDIDATES);
  }
}

export function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_EXECUTION_ENV
  );
}

export function resolveLocalBrowserExecutable(): string | null {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (fromEnv) return fromEnv;
  return detectLocalBrowserExecutable();
}

export function localBrowserMissingMessage(): string {
  return process.platform === "win32"
    ? "PDF generation requires Google Chrome or Microsoft Edge, or set PUPPETEER_EXECUTABLE_PATH in .env.local."
    : "PDF generation requires Chrome/Chromium, or set PUPPETEER_EXECUTABLE_PATH in your environment.";
}
