"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  loadPresentationTemplate,
  loadPresentationTemplatePreview,
  resetPresentationTemplate,
  savePresentationTemplate,
} from "@/app/settings/documents/templates/actions";
import {
  DocumentLayoutScopeSelect,
  type DocumentLayoutLocationOption,
} from "@/components/settings/document-layout/document-layout-scope-select";
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
  fieldLayoutHref: string;
  initialTemplates: DocumentPresentationTemplate[];
  locations?: DocumentLayoutLocationOption[];
  canEdit: boolean;
  gstRegistered?: boolean;
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
}: Props) {
  const [scope, setScope] = useState<DocumentLayoutScope>(TENANT_LAYOUT_SCOPE);
  const [viewContext, setViewContext] = useState<PresentationViewContext>("PDF_PRINT");
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

  useEffect(() => {
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
  }, [moduleKey, viewContext, layoutScopeKey(scope), gstRegistered]);

  const showGstCompliance = moduleKey === "SALES_INVOICE" && gstRegistered;
  const complianceConfig =
    shellConfig.compliance ?? (showGstCompliance ? defaultGstComplianceConfig() : undefined);

  useEffect(() => {
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
  }, [moduleKey, viewContext, shellConfig, scope, showGstCompliance, complianceConfig]);

  const patchShell = (patch: {
    header?: Partial<PresentationShellConfig["header"]>;
    footer?: Partial<PresentationShellConfig["footer"]>;
    sections?: Partial<PresentationShellConfig["sections"]>;
    compliance?: Partial<NonNullable<PresentationShellConfig["compliance"]>>;
  }) => {
    setShellConfig((current) => ({
      ...current,
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
        scope,
      });
      if ("error" in result) {
        toast.error(result.error);
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
      setShellConfig(result.template.shellConfig);
      toast.success("Reset to system default.");
    });
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
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
        <Button variant="outline" size="sm" asChild>
          <Link href={fieldLayoutHref} target="_blank" rel="noopener noreferrer">
            Edit fields
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
      </div>

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

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-4 overflow-y-auto pr-1">
          <OrgSettingsSection title="Letterhead" description="Branding at the top of the document.">
            <div className="space-y-2">
              <ToggleRow
                id={`${moduleKey}-showLogo`}
                label="Show logo"
                checked={shellConfig.header.showLogo}
                disabled={!canEdit}
                onCheckedChange={(value) => patchShell({ header: { showLogo: value } })}
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
                  placeholder="Leave blank to use document number label"
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
                hint="Field visibility is in Module settings"
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
                {isPending ? "Saving…" : "Save template"}
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
      </div>
    </div>
  );
}
