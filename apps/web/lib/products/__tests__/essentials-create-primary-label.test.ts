import { describe, expect, it } from "vitest";
import { essentialsCreatePrimaryLabel } from "@/lib/products/item-editor/editor-shell-shared";

describe("essentialsCreatePrimaryLabel", () => {
  it("returns Save before the item exists", () => {
    expect(
      essentialsCreatePrimaryLabel({
        createEssentialsWizard: true,
        activeWizardStage: "essentials",
        itemId: null,
        isDirty: false,
        submitPending: false,
      })
    ).toBe("Save");
  });

  it("returns Save for profile-only edits after create", () => {
    expect(
      essentialsCreatePrimaryLabel({
        createEssentialsWizard: true,
        activeWizardStage: "essentials",
        itemId: "item-1",
        isDirty: true,
        submitPending: false,
      })
    ).toBe("Save");
  });

  it("returns Save & continue when profile and variant draft are both dirty", () => {
    expect(
      essentialsCreatePrimaryLabel({
        createEssentialsWizard: true,
        activeWizardStage: "essentials",
        itemId: "item-1",
        isDirty: true,
        compositionDraftDirty: true,
        submitPending: false,
      })
    ).toBe("Save & continue");
  });

  it("returns Next once the item is saved and clean", () => {
    expect(
      essentialsCreatePrimaryLabel({
        createEssentialsWizard: true,
        activeWizardStage: "essentials",
        itemId: "item-1",
        isDirty: false,
        submitPending: false,
      })
    ).toBe("Next");
  });

  it("returns Next when only the variant matrix draft changed", () => {
    expect(
      essentialsCreatePrimaryLabel({
        createEssentialsWizard: true,
        activeWizardStage: "essentials",
        itemId: "item-1",
        isDirty: false,
        compositionDraftDirty: true,
        submitPending: false,
      })
    ).toBe("Next");
  });

  it("returns Save & continue before create when the Variants stage applies", () => {
    expect(
      essentialsCreatePrimaryLabel({
        createEssentialsWizard: true,
        activeWizardStage: "essentials",
        itemId: null,
        isDirty: true,
        showVariantsWizardStage: true,
        submitPending: false,
      })
    ).toBe("Save & continue");
  });

  it("returns null outside the create essentials wizard", () => {
    expect(
      essentialsCreatePrimaryLabel({
        createEssentialsWizard: false,
        activeWizardStage: "essentials",
        itemId: "item-1",
        isDirty: false,
        submitPending: false,
      })
    ).toBeNull();
  });
});
