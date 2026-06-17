"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  loadPresentationTemplatePreview,
  resetPresentationTemplate,
  savePresentationTemplate,
} from "@/app/settings/documents/templates/actions";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DocumentPresentationTemplate, PresentationShellConfig, PresentationViewContext } from "@/lib/documents/print/types";
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
  initialTemplates: DocumentPresentationTemplate[];
  canEdit: boolean;
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

export function PresentationTemplatePanel({
  moduleKey,
  moduleLabel,
  initialTemplates,
  canEdit,
}: Props) {
  const [viewContext, setViewContext] = useState<PresentationViewContext>("PDF_PRINT");
  const [templates, setTemplates] = useState(initialTemplates);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [isPreviewPending, startPreviewTransition] = useTransition();

  const activeTemplate = useMemo(
    () => templates.find((row) => row.viewContext === viewContext) ?? templates[0],
    [templates, viewContext]
  );

  const [shellConfig, setShellConfig] = useState<PresentationShellConfig>(
    () => activeTemplate?.shellConfig ?? initialTemplates[0].shellConfig
  );

  useEffect(() => {
    if (activeTemplate) {
      setShellConfig(activeTemplate.shellConfig);
    }
  }, [activeTemplate]);

  useEffect(() => {
    startPreviewTransition(async () => {
      const result = await loadPresentationTemplatePreview({
        moduleKey,
        viewContext,
        shellConfig,
      });
      if ("html" in result) {
        setPreviewHtml(result.html);
      }
    });
  }, [moduleKey, viewContext, shellConfig]);

  const patchShell = (patch: {
    header?: Partial<PresentationShellConfig["header"]>;
    footer?: Partial<PresentationShellConfig["footer"]>;
    sections?: Partial<PresentationShellConfig["sections"]>;
  }) => {
    setShellConfig((current) => ({
      ...current,
      header: { ...current.header, ...(patch.header ?? {}) },
      footer: { ...current.footer, ...(patch.footer ?? {}) },
      sections: { ...current.sections, ...(patch.sections ?? {}) },
    }));
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await savePresentationTemplate({
        moduleKey,
        viewContext,
        shellConfig,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setTemplates((current) =>
        current.map((row) =>
          row.viewContext === viewContext ? { ...row, shellConfig, isCustomized: true } : row
        )
      );
      toast.success("Template saved.");
    });
  };

  const handleReset = () => {
    startTransition(async () => {
      const result = await resetPresentationTemplate({ moduleKey, viewContext });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setShellConfig(result.template.shellConfig);
      setTemplates((current) =>
        current.map((row) => (row.viewContext === viewContext ? result.template : row))
      );
      toast.success("Reset to system default.");
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings/documents/templates">
            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
            All templates
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{moduleLabel}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Appearance for print and email PDF output. Configure which sections appear and how your
          organization branding is shown.
        </p>
      </div>

      <Tabs value={viewContext} onValueChange={(value) => setViewContext(value as PresentationViewContext)}>
        <TabsList>
          {VIEW_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <OrgSettingsSection title="Letterhead" description="Organization branding shown at the top of the document.">
            <div className="space-y-2">
              <ToggleRow
                id="showLogo"
                label="Show logo"
                checked={shellConfig.header.showLogo}
                disabled={!canEdit}
                onCheckedChange={(value) => patchShell({ header: { showLogo: value } })}
              />
              <ToggleRow
                id="showOrgName"
                label="Show organization name"
                checked={shellConfig.header.showOrgName}
                disabled={!canEdit}
                onCheckedChange={(value) => patchShell({ header: { showOrgName: value } })}
              />
              <ToggleRow
                id="showOrgAddress"
                label="Show billing address"
                checked={shellConfig.header.showOrgAddress}
                disabled={!canEdit}
                onCheckedChange={(value) => patchShell({ header: { showOrgAddress: value } })}
              />
              <ToggleRow
                id="showDocumentTitle"
                label="Show document title"
                checked={shellConfig.header.showDocumentTitle}
                disabled={!canEdit}
                onCheckedChange={(value) => patchShell({ header: { showDocumentTitle: value } })}
              />
              <div className="space-y-2 rounded-md border border-border/60 px-3 py-2.5">
                <Label htmlFor="titleOverride" className="text-sm font-medium">
                  Title override
                </Label>
                <Input
                  id="titleOverride"
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

          <OrgSettingsSection title="Sections" description="Control which content blocks are included.">
            <div className="space-y-2">
              <ToggleRow
                id="showHeaderFields"
                label="Header fields"
                hint="Configured under Module settings → Print tab"
                checked={shellConfig.sections.showHeaderFields}
                disabled={!canEdit}
                onCheckedChange={(value) => patchShell({ sections: { showHeaderFields: value } })}
              />
              <ToggleRow
                id="showLineTable"
                label="Line items table"
                checked={shellConfig.sections.showLineTable}
                disabled={!canEdit}
                onCheckedChange={(value) => patchShell({ sections: { showLineTable: value } })}
              />
              <ToggleRow
                id="showTotals"
                label="Totals block"
                checked={shellConfig.sections.showTotals}
                disabled={!canEdit}
                onCheckedChange={(value) => patchShell({ sections: { showTotals: value } })}
              />
              <ToggleRow
                id="showTerms"
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

          <OrgSettingsSection title="Footer" description="Optional legal or compliance text at the bottom.">
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
              <Button type="button" disabled={isPending} onClick={handleSave}>
                {isPending ? "Saving…" : "Save template"}
              </Button>
              <Button type="button" variant="outline" disabled={isPending} onClick={handleReset}>
                <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
                Reset to default
              </Button>
            </div>
          ) : null}
        </div>

        <OrgSettingsSection title="Preview" description="Sample document with your current organization branding.">
          <div
            className={cn(
              "surface-inset min-h-[480px] overflow-hidden rounded-lg border border-border/60 bg-white",
              isPreviewPending && "opacity-70"
            )}
          >
            {previewHtml ? (
              <iframe
                title="Template preview"
                srcDoc={previewHtml}
                className="h-[640px] w-full border-0 bg-white"
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
