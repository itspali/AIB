import { describe, expect, it } from "vitest";
import {
  canEssentialsWizardFastAdvance,
  canEssentialsWizardNavigateOnly,
  resolveEssentialsWizardAdvance,
} from "@/lib/products/item-editor/editor-shell-shared";

describe("resolveEssentialsWizardAdvance", () => {
  it("stays on first create before an item id exists", () => {
    expect(
      resolveEssentialsWizardAdvance({
        itemId: null,
        isDirty: true,
      })
    ).toBe(false);
  });

  it("stays when saving profile-only edits after create", () => {
    expect(
      resolveEssentialsWizardAdvance({
        itemId: "item-1",
        isDirty: true,
        compositionDraftDirty: false,
      })
    ).toBe(false);
  });

  it("advances when essentials is dirty and the Variants wizard stage applies", () => {
    expect(
      resolveEssentialsWizardAdvance({
        itemId: "item-1",
        isDirty: true,
        showVariantsWizardStage: true,
      })
    ).toBe(true);
  });

  it("advances when profile is clean (Next)", () => {
    expect(
      resolveEssentialsWizardAdvance({
        itemId: "item-1",
        isDirty: false,
      })
    ).toBe(true);
  });

  it("advances when variant draft work is pending even if profile is dirty", () => {
    expect(
      resolveEssentialsWizardAdvance({
        itemId: "item-1",
        isDirty: true,
        compositionDraftDirty: true,
      })
    ).toBe(true);
  });

  it("advances when only the variant matrix draft changed", () => {
    expect(
      resolveEssentialsWizardAdvance({
        itemId: "item-1",
        isDirty: false,
        compositionDraftDirty: true,
      })
    ).toBe(true);
  });

  it("advances on first create save when the Variants wizard stage applies", () => {
    expect(
      resolveEssentialsWizardAdvance({
        itemId: null,
        isDirty: true,
        isFirstCreateSave: true,
        showVariantsWizardStage: true,
      })
    ).toBe(true);
  });

  it("stays on first create save for single-SKU essentials-only path", () => {
    expect(
      resolveEssentialsWizardAdvance({
        itemId: null,
        isDirty: true,
        isFirstCreateSave: true,
        showVariantsWizardStage: false,
      })
    ).toBe(false);
  });
});

describe("canEssentialsWizardFastAdvance", () => {
  it("requires a persisted item and no pending edits", () => {
    expect(
      canEssentialsWizardFastAdvance({
        itemId: "item-1",
        isDirty: false,
        compositionDraftDirty: false,
      })
    ).toBe(true);

    expect(
      canEssentialsWizardFastAdvance({
        itemId: null,
        isDirty: false,
      })
    ).toBe(false);

    expect(
      canEssentialsWizardFastAdvance({
        itemId: "item-1",
        isDirty: false,
        compositionDraftDirty: true,
      })
    ).toBe(false);
  });
});

describe("canEssentialsWizardNavigateOnly", () => {
  it("advances when profile is clean even if variant draft is dirty", () => {
    expect(
      canEssentialsWizardNavigateOnly({
        itemId: "item-1",
        isDirty: false,
        compositionDraftDirty: true,
      })
    ).toBe(true);
  });

  it("does not advance when profile is dirty", () => {
    expect(
      canEssentialsWizardNavigateOnly({
        itemId: "item-1",
        isDirty: true,
        compositionDraftDirty: true,
      })
    ).toBe(false);
  });

  it("does not advance before first persist", () => {
    expect(
      canEssentialsWizardNavigateOnly({
        itemId: null,
        isDirty: false,
      })
    ).toBe(false);
  });
});
