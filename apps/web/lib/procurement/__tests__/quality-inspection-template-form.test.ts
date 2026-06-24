import { describe, expect, it } from "vitest";
import {
  buildQcTestTemplateSavePayload,
  createEmptyQcTestParameterRow,
  resolveQcTestTemplateFormForSave,
  validateQcTestTemplateForm,
} from "@/lib/procurement/quality-inspection/template-form";

describe("resolveQcTestTemplateFormForSave", () => {
  it("uses default template name when tests exist but name is blank", () => {
    const resolved = resolveQcTestTemplateFormForSave(
      {
        name: "",
        description: "",
        parameters: [{ ...createEmptyQcTestParameterRow(), name: "Visual" }],
      },
      { defaultTemplateName: "Fabrics" }
    );

    expect(resolved.name).toBe("Fabrics");
    expect(validateQcTestTemplateForm(resolved)).toBeNull();
  });
});

describe("validateQcTestTemplateForm", () => {
  it("requires a template name when parameters exist", () => {
    expect(
      validateQcTestTemplateForm({
        name: "",
        description: "",
        parameters: [{ ...createEmptyQcTestParameterRow(), name: "Visual" }],
      })
    ).toMatch(/template name/i);
  });

  it("requires at least one parameter when a name is set", () => {
    expect(
      validateQcTestTemplateForm({
        name: "Incoming",
        description: "",
        parameters: [],
      })
    ).toMatch(/at least one test parameter/i);
  });
});

describe("buildQcTestTemplateSavePayload", () => {
  it("returns clear when template is empty", () => {
    expect(
      buildQcTestTemplateSavePayload({
        name: "",
        description: "",
        parameters: [],
      })
    ).toEqual({ clear: true });
  });

  it("maps parameter rows for save", () => {
    const payload = buildQcTestTemplateSavePayload({
      name: "Incoming",
      description: "Standard checks",
      parameters: [
        {
          ...createEmptyQcTestParameterRow(),
          name: "Weight",
          parameter_type: "NUMERIC",
          min_value: "1",
          max_value: "2",
        },
      ],
    });

    expect(payload).toMatchObject({
      clear: false,
      name: "Incoming",
      description: "Standard checks",
      parameters: [
        expect.objectContaining({
          name: "Weight",
          parameter_type: "NUMERIC",
          min_value: "1",
          max_value: "2",
        }),
      ],
    });
  });
});
