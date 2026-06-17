import {
  DEFAULT_PRESENTATION_SHELL_CONFIG,
  DEFAULT_PRESENTATION_STYLE_CONFIG,
  normalizePresentationShellConfig,
  normalizePresentationStyleConfig,
} from "@/lib/documents/print/default-shell-config";
import { getPresentationTemplateKey } from "@/lib/documents/print/presentation-catalog";
import type { DocumentPresentationTemplate, PresentationViewContext } from "@/lib/documents/print/types";
import type { DocumentModuleKey } from "@/lib/documents/types";

export type DocumentPresentationTemplateRow = {
  template_key: string;
  module_key: string;
  view_context: string;
  label: string;
  description: string | null;
  shell_config: unknown;
  style_config: unknown;
  is_default: boolean;
  is_active: boolean;
  is_customized: boolean;
};

export type DocumentPresentationSystemDefaultRow = {
  template_key: string;
  module_key: string;
  view_context: string;
  label: string;
  description: string | null;
  shell_config: unknown;
  style_config: unknown;
};

function isPresentationViewContext(value: string): value is PresentationViewContext {
  return value === "PDF_PRINT" || value === "EMAIL_HTML";
}

export function presentationTemplateFromRow(
  row: DocumentPresentationTemplateRow | DocumentPresentationSystemDefaultRow | null,
  moduleKey: DocumentModuleKey,
  viewContext: PresentationViewContext
): DocumentPresentationTemplate {
  const templateKey = getPresentationTemplateKey(moduleKey);

  if (!row) {
    return {
      templateKey,
      moduleKey,
      viewContext,
      label: "Standard",
      description: null,
      shellConfig: DEFAULT_PRESENTATION_SHELL_CONFIG,
      styleConfig: DEFAULT_PRESENTATION_STYLE_CONFIG,
      isDefault: true,
      isActive: true,
      isCustomized: false,
    };
  }

  return {
    templateKey: row.template_key,
    moduleKey: row.module_key as DocumentModuleKey,
    viewContext: isPresentationViewContext(row.view_context) ? row.view_context : viewContext,
    label: row.label,
    description: row.description,
    shellConfig: normalizePresentationShellConfig(row.shell_config as never),
    styleConfig: normalizePresentationStyleConfig(row.style_config as never),
    isDefault: "is_default" in row ? Boolean(row.is_default) : true,
    isActive: "is_active" in row ? Boolean(row.is_active) : true,
    isCustomized: "is_customized" in row ? Boolean(row.is_customized) : false,
  };
}

export function serializePresentationTemplate(
  template: DocumentPresentationTemplate
): Pick<
  DocumentPresentationTemplateRow,
  "template_key" | "module_key" | "view_context" | "label" | "description" | "shell_config" | "style_config"
> {
  return {
    template_key: template.templateKey,
    module_key: template.moduleKey,
    view_context: template.viewContext,
    label: template.label,
    description: template.description,
    shell_config: template.shellConfig,
    style_config: template.styleConfig,
  };
}
