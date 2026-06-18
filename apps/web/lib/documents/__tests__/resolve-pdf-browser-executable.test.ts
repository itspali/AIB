import { describe, expect, it } from "vitest";
import {
  detectLocalBrowserExecutable,
  resolveLocalBrowserExecutable,
} from "@/lib/email/resolve-pdf-browser-executable";

describe("resolve-pdf-browser-executable", () => {
  it("detectLocalBrowserExecutable returns a string path or null", () => {
    const detected = detectLocalBrowserExecutable();
    expect(detected === null || detected.length > 0).toBe(true);
  });

  it("resolveLocalBrowserExecutable prefers PUPPETEER_EXECUTABLE_PATH", () => {
    const previous = process.env.PUPPETEER_EXECUTABLE_PATH;
    process.env.PUPPETEER_EXECUTABLE_PATH = "C:\\custom\\chrome.exe";
    try {
      expect(resolveLocalBrowserExecutable()).toBe("C:\\custom\\chrome.exe");
    } finally {
      if (previous === undefined) {
        delete process.env.PUPPETEER_EXECUTABLE_PATH;
      } else {
        process.env.PUPPETEER_EXECUTABLE_PATH = previous;
      }
    }
  });
});
