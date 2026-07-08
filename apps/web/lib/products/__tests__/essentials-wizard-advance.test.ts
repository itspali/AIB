import { describe, expect, it } from "vitest";
import {
  canEssentialsWizardFastAdvance,
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
