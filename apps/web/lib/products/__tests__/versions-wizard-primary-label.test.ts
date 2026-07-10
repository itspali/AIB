import { describe, expect, it } from "vitest";
import { versionsWizardPrimaryLabel } from "@/lib/products/item-editor/editor-shell-shared";

describe("versionsWizardPrimaryLabel", () => {
  it("shows bulk-create label when combinations are ready", () => {
    expect(
      versionsWizardPrimaryLabel({
        createWizard: true,
        activeWizardStage: "versions",
        submitPending: false,
        matrixState: { includedCount: 3, canGenerate: true },
        wizardIsLast: false,
        mode: "create",
      })
    ).toBe("Create 3 variants");
  });

  it("shows continue when nothing to generate", () => {
    expect(
      versionsWizardPrimaryLabel({
        createWizard: true,
        activeWizardStage: "versions",
        submitPending: false,
        matrixState: { includedCount: 0, canGenerate: false },
        wizardIsLast: false,
        mode: "edit",
      })
    ).toBe("Continue");
  });

  it("shows creating while pending with generate work", () => {
    expect(
      versionsWizardPrimaryLabel({
        createWizard: true,
        activeWizardStage: "versions",
        submitPending: true,
        matrixState: { includedCount: 2, canGenerate: true },
        wizardIsLast: false,
        mode: "create",
      })
    ).toBe("Creating…");
  });
});
