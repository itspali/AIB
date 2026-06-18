import "server-only";

import chromium from "@sparticuz/chromium-min";
import puppeteer, { type LaunchOptions } from "puppeteer-core";
import {
  isServerlessRuntime,
  localBrowserMissingMessage,
  resolveLocalBrowserExecutable,
} from "@/lib/email/resolve-pdf-browser-executable";

export type GeneratePdfResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string };

async function resolveLaunchOptions(): Promise<LaunchOptions> {
  const localExecutable = resolveLocalBrowserExecutable();
  if (localExecutable) {
    return {
      executablePath: localExecutable,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    };
  }

  if (process.platform !== "linux" && !isServerlessRuntime()) {
    throw new Error(localBrowserMissingMessage());
  }

  return {
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  };
}

export async function generatePdfFromHtml(html: string): Promise<GeneratePdfResult> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const launchOptions = await resolveLaunchOptions();
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
    });
    return { ok: true, buffer: Buffer.from(pdf) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "PDF generation failed unexpectedly.";
    if (process.env.NODE_ENV === "development") {
      console.error("[generatePdfFromHtml]", message);
    }
    return { ok: false, error: message };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
