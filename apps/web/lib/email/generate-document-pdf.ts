import "server-only";

import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";

export async function generatePdfFromHtml(html: string): Promise<Buffer | null> {
  const localChrome = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();

  try {
    const executablePath = localChrome ?? (await chromium.executablePath());

    const browser = await puppeteer.launch({
      args: await puppeteer.defaultArgs(),
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
    });
    await browser.close();
    return Buffer.from(pdf);
  } catch {
    return null;
  }
}
