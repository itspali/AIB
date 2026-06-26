"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  loadPresentationTemplate,
  loadPresentationTemplatePreview,
  resetPresentationTemplate,
  savePresentationTemplate,
} from "@/app/settings/presentation/documents/actions";
import {
  DocumentLayoutScopeSelect,
  type DocumentLayoutLocationOption,
} from "@/components/settings/document-layout/document-layout-scope-select";
import { PresentationLetterheadLogoControls } from "@/components/settings/document-templates/presentation-letterhead-logo-controls";
import { PresentationPageSpacingSection } from "@/components/settings/document-templates/presentation-page-spacing-section";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_PRESENTATION_SHELL_CONFIG } from "@/lib/documents/print/default-shell-config";
import { defaultGstComplianceConfig } from "@/lib/documents/print/gst-presentation-compliance";
import type {
  DocumentPresentationTemplate,
  PresentationShellConfig,
  PresentationStyleConfig,
  PresentationViewContext,
} from "@/lib/documents/print/types";
import {
  TENANT_LAYOUT_SCOPE,
  layoutScopeKey,
  type DocumentLayoutScope,
} from "@/lib/documents/layout-scope";
import type { DocumentModuleKey } from "@/lib/documents/types";
import { cn } from "@/lib/utils";

const textareaClassName = cn(
  "min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
  "ring-offset-background placeholder:text-muted-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
);

type Props = {
  moduleKey: DocumentModuleKey;
  moduleLabel: string;
  fieldLayoutHref?: string;
  initialTemplates: DocumentPresentationTemplate[];
  locations?: DocumentLayoutLocationOption[];
  canEdit: boolean;
  gstRegistered?: boolean;
  embedded?: boolean;
  controlledScope?: DocumentLayoutScope;
  controlledViewContext?: PresentationViewContext;
  shellConfigSeed?: PresentationShellConfig | null;
  shellConfigSeedVersion?: number;
  styleConfigSeed?: PresentationStyleConfig | null;
  onShellConfigChange?: (config: PresentationShellConfig) => void;
  onStyleConfigChange?: (config: PresentationStyleConfig) => void;
  /** Embedded designer: persist field layout when appearance is saved. */
  companionLayoutSave?: () => Promise<{ error?: string } | void>;
};

const VIEW_TABS: { id: PresentationViewContext; label: string }[] = [
  { id: "PDF_PRINT", label: "Print" },
  { id: "EMAIL_HTML", label: "Email PDF" },
];

function ToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 px-3 py-2.5">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function PresentationTemplateEditor({
  moduleKey,
  moduleLabel,
  fieldLayoutHref,
  initialTemplates,
  locations = [],
  canEdit,
  gstRegistered = false,
  embedded = false,
  controlledScope,
  controlledViewContext,
  shellConfigSeed,
  shellConfigSeedVersion,
  styleConfigSeed,
  onShellConfigChange,
  onStyleConfigChange,
  companionLayoutSave,
}: Props) {
  const [scope, setScope] = useState<DocumentLayoutScope>(controlledScope ?? TENANT_LAYOUT_SCOPE);
  const [viewContext, setViewContext] = useState<PresentationViewContext>(
    controlledViewContext ?? "PDF_PRINT"
  );
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [isPreviewPending, startPreviewTransition] = useTransition();
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);

  const tenantTemplate = useMemo(
    () => initialTemplates.find((row) => row.viewContext === viewContext) ?? initialTemplates[0],
    [initialTemplates, viewContext]
  );

  const [shellConfig, setShellConfig] = useState<PresentationShellConfig>(
    () => tenantTemplate?.shellConfig ?? initialTemplates[0]?.shellConfig ?? DEFAULT_PRESENTATION_SHELL_CONFIG
  );
  const notifyParentOnShellCommit = useRef(false);
  const appliedShellSeedVersionRef = useRef<number | null>(null);

  const commitShellConfig = (
    updater: PresentationShellConfig | ((current: PresentationShellConfig) => PresentationShellConfig),
    options?: { syncParent?: boolean }
  ) => {
    notifyParentOnShellCommit.current = options?.syncParent !== false && onShellConfigChange != null;
    setShellConfig((current) => (typeof updater === "function" ? updater(current) : updater));
  };

  useEffect(() => {
    if (!controlledScope) return;
    setScope((current) =>
      layoutScopeKey(current) === layoutScopeKey(controlledScope) ? current : controlledScope
    );
  }, [controlledScope]);

  useEffect(() => {
    if (!controlledViewContext) return;
    setViewContext((current) => (current === controlledViewContext ? current : controlledViewContext));
  }, [controlledViewContext]);

  useEffect(() => {
    if (!embedded || !shellConfigSeed || shellConfigSeedVersion == null) return;
    if (appliedShellSeedVersionRef.current === shellConfigSeedVersion) return;
    appliedShellSeedVersionRef.current = shellConfigSeedVersion;
    commitShellConfig(shellConfigSeed, { syncParent: false });
  }, [embedded, shellConfigSeed, shellConfigSeedVersion]);

  useEffect(() => {
    if (!notifyParentOnShellCommit.current) return;
    notifyParentOnShellCommit.current = false;
    onShellConfigChange?.(shellConfig);
  }, [shellConfig, onShellConfigChange]);

  useEffect(() => {
    if (embedded) return;
    let cancelled = false;
    setIsLoadingTemplate(true);
    void loadPresentationTemplate({ moduleKey, viewContext, scope }).then((result) => {
      if (cancelled) return;
      setIsLoadingTemplate(false);
      if ("template" in result) {
        let nextConfig = result.template.shellConfig;
        if (moduleKey === "SALES_INVOICE" && gstRegistered && !nextConfig.compliance) {
          nextConfig = {
            ...nextConfig,
            compliance: defaultGstComplianceConfig(),
            header: {
              ...nextConfig.header,
              titleOverride: nextConfig.header.titleOverride ?? "Tax Invoice",
            },
          };
        }
        setShellConfig(nextConfig);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [moduleKey, viewContext, layoutScopeKey(scope), gstRegistered, embedded]);

  const showGstCompliance = moduleKey === "SALES_INVOICE" && gstRegistered;
  const complianceConfig =
    shellConfig.compliance ?? (showGstCompliance ? defaultGstComplianceConfig() : undefined);

  useEffect(() => {
    if (embedded) return;
    const previewShellConfig =
      showGstCompliance && !shellConfig.compliance
        ? { ...shellConfig, compliance: complianceConfig }
        : shellConfig;

    startPreviewTransition(async () => {
      const result = await loadPresentationTemplatePreview({
        moduleKey,
        viewContext,
        shellConfig: previewShellConfig,
        scope,
      });
      if ("html" in result) {
        setPreviewHtml(result.html);
      }
    });
  }, [moduleKey, viewContext, shellConfig, scope, showGstCompliance, complianceConfig, embedded]);

  const patchShell = (patch: {
    margins?: Partial<PresentationShellConfig["margins"]>;
    padding?: Partial<PresentationShellConfig["padding"]>;
    header?: Partial<PresentationShellConfig["header"]>;
    footer?: Partial<PresentationShellConfig["footer"]>;
    sections?: Partial<PresentationShellConfig["sections"]>;
    compliance?: Partial<NonNullable<PresentationShellConfig["compliance"]>>;
  }) => {
    commitShellConfig((current) => ({
      ...current,
      margins: patch.margins ? { ...current.margins, ...patch.margins } : current.margins,
      padding: patch.padding ? { ...current.padding, ...patch.padding } : current.padding,
      header: { ...current.header, ...(patch.header ?? {}) },
      footer: { ...current.footer, ...(patch.footer ?? {}) },
      sections: { ...current.sections, ...(patch.sections ?? {}) },
      compliance: patch.compliance
        ? {
            ...(current.compliance ?? defaultGstComplianceConfig()),
            ...patch.compliance,
          }
        : current.compliance,
    }));
  };

  const handleSave = () => {
    startTransition(async () => {
      const payloadConfig =
        showGstCompliance && !shellConfig.compliance
          ? { ...shellConfig, compliance: complianceConfig }
          : shellConfig;

      const result = await savePresentationTemplate({
        moduleKey,
        viewContext,
        shellConfig: payloadConfig,
        styleConfig: embedded ? styleConfigSeed ?? undefined : undefined,
        scope,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if (companionLayoutSave) {
        const companionResult = await companionLayoutSave();
        if (companionResult?.error) {
          toast.error(companionResult.error);
          return;
        }
        toast.success("Document template saved.");
        return;
      }

      toast.success("Template saved.");
    });
  };

  const handleReset = () => {
    startTransition(async () => {
      const result = await resetPresentationTemplate({ moduleKey, viewContext, scope });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      commitShellConfig(result.template.shellConfig, { syncParent: false });
      onShellConfigChange?.(result.template.shellConfig);
      onStyleConfigChange?.(result.template.styleConfig);
      toast.success("Reset to system default.");
    });
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      {!embedded ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{moduleLabel}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Appearance for print and email PDF output.
            </p>
            {moduleKey === "SALES_INVOICE" && gstRegistered ? (
              <p className="mt-1 text-xs text-muted-foreground">
                GST tax invoice compliance blocks can be tuned below. Title defaults to Tax Invoice
                when blank.
              </p>
            ) : null}
          </div>
          {fieldLayoutHref ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={fieldLayoutHref} target="_blank" rel="noopener noreferrer">
                Edit fields
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {!embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={viewContext}
            onValueChange={(value) => setViewContext(value as PresentationViewContext)}
          >
            <TabsList>
              {VIEW_TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <DocumentLayoutScopeSelect
            scope={scope}
            locations={locations}
            disabled={!canEdit || isLoadingTemplate}
            onScopeChange={setScope}
          />
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-0 flex-1",
          embedded ? "space-y-4 overflow-y-auto" : "grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]"
        )}
      >
        <div className={cn("space-y-4", embedded ? "" : "overflow-y-auto pr-1")}>
          <PresentationPageSpacingSection
            moduleKey={moduleKey}
            margins={shellConfig.margins}
            padding={shellConfig.padding}
            disabled={!canEdit}
            onMarginsChange={(side, value) => patchShell({ margins: { [side]: value } })}
            onPaddingChange={(side, value) => patchShell({ padding: { [side]: value } })}
          />

          <OrgSettingsSection title="Letterhead" description="Branding at the top of the document.">
            <div className="space-y-2">
              <ToggleRow
                id={`${moduleKey}-showLogo`}
                label="Show logo"
                checked={shellConfig.header.showLogo}
                disabled={!canEdit}
                onCheckedChange={(value) => patchShell({ header: { showLogo: value } })}
              />
              <PresentationLetterheadLogoControls
                idPrefix={moduleKey}
                header={shellConfig.header}
                disabled={!canEdit}
                onPatch={(patch) => patchShell({ header: patch })}
              />
              <ToggleRow
                id={`${moduleKey}-showOrgName`}
                label="Show organization name"
                checked={shellConfig.header.showOrgName}
                disabled={!canEdit}
                onCheckedChange={(value) => patchShell({ header: { showOrgName: value } })}
              />
              <ToggleRow
                id={`${moduleKey}-showOrgAddress`}
                label="Show billing address"
                checked={shellConfig.header.showOrgAddress}
                disabled={!canEdit}
                onCheckedChange={(value) => patchShell({ header: { showOrgAddress: value } })}
              />
              <ToggleRow
                id={`${moduleKey}-showDocumentTitle`}
                label="Show document title"
                checked={shellConfig.header.showDocumentTitle}
                disabled={!canEdit}
                onCheckedChange={(value) => patchShell({ header: { showDocumentTitle: value } })}
              />
              <div className="space-y-2 rounded-md border border-border/60 px-3 py-2.5">
                <Label htmlFor={`${moduleKey}-titleOverride`} className="text-sm font-medium">
                  Title override
                </Label>
                <Input
                  id={`${moduleKey}-titleOverride`}
                  value={shellConfig.header.titleOverride ?? ""}
                  disabled={!canEdit}
                  placeholder="Leave blank for default document title"
                  onChange={(event) =>
                    patchShell({
                      header: {
                        titleOverride: event.target.value.trim() ? event.target.value : null,
                      },
                    })
                  }
                />
              </div>
            </div>
          </OrgSettingsSection>

          <OrgSettingsSection title="Sections" description="Which content blocks are included.">
            <div className="space-y-2">
              <ToggleRow
                id={`${moduleKey}-showHeaderFields`}
                label="Header fields"
                checked={shellConfig.sections.showHeaderFields}
                disabled={!canEdit}
                onCheckedChange={(value) => patchShell({ sections: { showHeaderFields: value } })}
              />
              <ToggleRow
                id={`${moduleKey}-showLineTable`}
                label="Line items table"
                checked={shellConfig.sections.showLineTable}
                disabled={!canEdit}
                onCheckedChange={(value) => patchShell({ sections: { showLineTable: value } })}
              />
              <ToggleRow
                id={`${moduleKey}-showTotals`}
                label="Totals block"
                checked={shellConfig.sections.showTotals}
                disabled={!canEdit}
                onCheckedChange={(value) => patchShell({ sections: { showTotals: value } })}
              />
              <ToggleRow
                id={`${moduleKey}-showTerms`}
                label="Terms & conditions"
                checked={shellConfig.sections.showTerms}
                disabled={!canEdit}
                onCheckedChange={(value) => patchShell({ sections: { showTerms: value } })}
              />
              {shellConfig.sections.showTerms ? (
                <textarea
                  value={shellConfig.sections.termsText}
                  disabled={!canEdit}
                  rows={4}
                  placeholder="Payment terms, warranty, or other legal text…"
                  className={textareaClassName}
                  onChange={(event) => patchShell({ sections: { termsText: event.target.value } })}
                />
              ) : null}
            </div>
          </OrgSettingsSection>

          {showGstCompliance && complianceConfig ? (
            <OrgSettingsSection
              title="GST compliance"
              description="Statutory blocks shown on tax invoices for GST-registered organizations."
            >
              <div className="space-y-2">
                <ToggleRow
                  id={`${moduleKey}-showPlaceOfSupply`}
                  label="Show place of supply"
                  checked={complianceConfig.showPlaceOfSupply}
                  disabled={!canEdit}
                  onCheckedChange={(value) => patchShell({ compliance: { showPlaceOfSupply: value } })}
                />
                <ToggleRow
                  id={`${moduleKey}-showIrnPlaceholder`}
                  label="Show e-invoice IRN placeholder"
                  checked={complianceConfig.showIrnPlaceholder}
                  disabled={!canEdit}
                  onCheckedChange={(value) => patchShell({ compliance: { showIrnPlaceholder: value } })}
                />
                <div className="space-y-2 rounded-md border border-border/60 px-3 py-2.5">
                  <Label htmlFor={`${moduleKey}-statutoryNote`} className="text-sm font-medium">
                    Statutory note
                  </Label>
                  <textarea
                    id={`${moduleKey}-statutoryNote`}
                    value={complianceConfig.statutoryNote}
                    disabled={!canEdit}
                    rows={3}
                    placeholder="Footer disclaimer for tax invoices…"
                    className={textareaClassName}
                    onChange={(event) =>
                      patchShell({ compliance: { statutoryNote: event.target.value } })
                    }
                  />
                </div>
              </div>
            </OrgSettingsSection>
          ) : null}

          <OrgSettingsSection title="Footer" description="Optional legal or compliance text.">
            <textarea
              value={shellConfig.footer.legalText}
              disabled={!canEdit}
              rows={3}
              placeholder="Registered office, CIN, or statutory disclaimer…"
              className={textareaClassName}
              onChange={(event) => patchShell({ footer: { legalText: event.target.value } })}
            />
          </OrgSettingsSection>

          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={isPending || isLoadingTemplate} onClick={handleSave}>
                {isPending ? "Saving…" : embedded ? "Save appearance" : "Save template"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending || isLoadingTemplate}
                onClick={handleReset}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
                Reset to default
              </Button>
            </div>
          ) : null}
        </div>

        {!embedded ? (
        <OrgSettingsSection
          title="Preview"
          description="Sample document with current organization branding."
        >
          <div
            className={cn(
              "surface-inset min-h-[520px] overflow-hidden rounded-lg border border-border/60 bg-white",
              (isPreviewPending || isLoadingTemplate) && "opacity-70"
            )}
          >
            {previewHtml ? (
              <iframe
                title="Template preview"
                srcDoc={previewHtml}
                className="h-[min(80vh,900px)] w-full border-0 bg-white"
                sandbox=""
              />
            ) : (
              <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                Loading preview…
              </div>
            )}
          </div>
        </OrgSettingsSection>
        ) : null}
      </div>
    </div>
  );
}
