import { describe, expect, it } from "vitest";
import {
  SETTINGS_LEGACY_REDIRECTS,
  SETTINGS_ROUTES,
  buildSettingsNavigationIndex,
  filterSettingsHubSections,
  flattenSettingsNavChildren,
} from "@/lib/settings/navigation";

describe("settings navigation", () => {
  it("exposes canonical route constants", () => {
    expect(SETTINGS_ROUTES.company).toBe("/settings/company");
    expect(SETTINGS_ROUTES.catalogsTax).toBe("/settings/catalogs/tax");
    expect(SETTINGS_ROUTES.operationsProcurement).toBe("/settings/operations/procurement");
  });

  it("maps legacy paths to canonical destinations", () => {
    const org = SETTINGS_LEGACY_REDIRECTS.find((row) => row.source === "/settings/organization");
    expect(org?.destination).toBe(SETTINGS_ROUTES.company);
  });

  it("builds omnibar entries for key settings areas", () => {
    const hrefs = buildSettingsNavigationIndex().map((entry) => entry.href);
    expect(hrefs).toContain(SETTINGS_ROUTES.presentationNotifications);
    expect(hrefs).toContain(SETTINGS_ROUTES.catalogsTaxGstr);
  });

  it("filters hub sections to non-empty groups", () => {
    const sections = filterSettingsHubSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections.every((section) => section.cards.length > 0)).toBe(true);
  });

  it("flattens sidebar children without profile", () => {
    const hrefs = flattenSettingsNavChildren().map((item) => item.href);
    expect(hrefs).toContain(SETTINGS_ROUTES.company);
    expect(hrefs).not.toContain(SETTINGS_ROUTES.account);
  });
});
