import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESENTATION_SHELL_CONFIG,
  normalizePresentationShellConfig,
} from "@/lib/documents/print/default-shell-config";

describe("normalizePresentationShellConfig", () => {
  it("returns defaults for empty input", () => {
    expect(normalizePresentationShellConfig(null)).toEqual(DEFAULT_PRESENTATION_SHELL_CONFIG);
  });

  it("merges partial header overrides", () => {
    const result = normalizePresentationShellConfig({
      header: { showLogo: false, titleOverride: "Tax Invoice" },
    } as never);
    expect(result.header.showLogo).toBe(false);
    expect(result.header.titleOverride).toBe("Tax Invoice");
    expect(result.header.showOrgName).toBe(true);
  });

  it("preserves terms section text", () => {
    const result = normalizePresentationShellConfig({
      sections: { showTerms: true, termsText: "Net 30 days." },
    } as never);
    expect(result.sections.showTerms).toBe(true);
    expect(result.sections.termsText).toBe("Net 30 days.");
  });
});
