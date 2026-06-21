"use client";

import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import type { DocumentTemplatesSettingsTerminalProps } from "@/components/settings/document-templates/document-templates-settings-terminal";

const DocumentTemplatesSettingsTerminal = lazyClientExport(
  () => import("@/components/settings/document-templates/document-templates-settings-terminal"),
  "DocumentTemplatesSettingsTerminal"
);

export function DocumentTemplatesSettingsTerminalLazy(
  props: DocumentTemplatesSettingsTerminalProps
) {
  return <DocumentTemplatesSettingsTerminal {...props} />;
}
