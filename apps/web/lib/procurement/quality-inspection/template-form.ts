import type { QcTestParameterType, QcTestTemplate } from "@/lib/procurement/quality-inspection/types";

export type QcTestParameterFormRow = {
  clientKey: string;
  id?: string | null;
  name: string;
  parameter_type: QcTestParameterType;
  min_value: string;
  max_value: string;
  expected_text: string;
  choice_options_text: string;
  is_mandatory: boolean;
};

export type QcTestTemplateFormState = {
  name: string;
  description: string;
  parameters: QcTestParameterFormRow[];
};

export const QC_TEST_PARAMETER_TYPES: QcTestParameterType[] = [
  "BOOLEAN",
  "NUMERIC",
  "TEXT",
  "CHOICE",
];

export function qcTestParameterTypeLabel(type: QcTestParameterType): string {
  switch (type) {
    case "BOOLEAN":
      return "Pass / fail";
    case "NUMERIC":
      return "Numeric range";
    case "TEXT":
      return "Text match";
    case "CHOICE":
      return "Choice list";
  }
}

export function createEmptyQcTestParameterRow(): QcTestParameterFormRow {
  return {
    clientKey: crypto.randomUUID(),
    name: "",
    parameter_type: "BOOLEAN",
    min_value: "",
    max_value: "",
    expected_text: "",
    choice_options_text: "",
    is_mandatory: true,
  };
}

export function defaultQcTestTemplateFormState(): QcTestTemplateFormState {
  return {
    name: "",
    description: "",
    parameters: [],
  };
}

export function qcTestTemplateFormFromTemplate(template: QcTestTemplate | null): QcTestTemplateFormState {
  if (!template) return defaultQcTestTemplateFormState();
  return {
    name: template.name,
    description: template.description ?? "",
    parameters: template.parameters.map((parameter) => ({
      clientKey: parameter.id,
      id: parameter.id,
      name: parameter.name,
      parameter_type: parameter.parameter_type,
      min_value: parameter.min_value ?? "",
      max_value: parameter.max_value ?? "",
      expected_text: parameter.expected_text ?? "",
      choice_options_text: parameter.choice_options.join(", "),
      is_mandatory: parameter.is_mandatory,
    })),
  };
}

export function parseChoiceOptionsText(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function validateQcTestTemplateForm(state: QcTestTemplateFormState): string | null {
  const hasParameters = state.parameters.length > 0;
  const name = state.name.trim();

  if (hasParameters && !name) {
    return "Template name is required when tests are defined.";
  }

  if (!hasParameters && !name && !state.description.trim()) {
    return null;
  }

  if (name && !hasParameters) {
    return "Add at least one test parameter or clear the template name.";
  }

  for (const [index, row] of state.parameters.entries()) {
    if (!row.name.trim()) {
      return `Test ${index + 1}: name is required.`;
    }
    if (row.parameter_type === "CHOICE" && parseChoiceOptionsText(row.choice_options_text).length === 0) {
      return `Test "${row.name.trim()}": add at least one choice option.`;
    }
  }

  return null;
}

export function buildQcTestTemplateSavePayload(state: QcTestTemplateFormState) {
  const trimmedName = state.name.trim();
  const trimmedDescription = state.description.trim();
  const parameters = state.parameters
    .filter((row) => row.name.trim())
    .map((row, index) => ({
      id: row.id ?? null,
      name: row.name.trim(),
      parameter_type: row.parameter_type,
      min_value: row.min_value.trim() || null,
      max_value: row.max_value.trim() || null,
      expected_text: row.expected_text.trim() || null,
      choice_options:
        row.parameter_type === "CHOICE" ? parseChoiceOptionsText(row.choice_options_text) : [],
      is_mandatory: row.is_mandatory,
      sort_order: index,
    }));

  if (!trimmedName && parameters.length === 0) {
    return { clear: true as const };
  }

  return {
    clear: false as const,
    name: trimmedName,
    description: trimmedDescription || null,
    parameters,
  };
}
