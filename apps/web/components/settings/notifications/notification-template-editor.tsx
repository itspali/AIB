"use client";

import { useMemo, useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  resetNotificationTemplate,
  saveNotificationTemplate,
} from "@/app/settings/notifications/actions";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import {
  NotificationMergeFieldChips,
  NotificationTemplatePreview,
} from "@/components/settings/notifications/notification-template-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getTemplateDefinition } from "@/lib/notifications/template-catalog";
import type { NotificationChannel, NotificationTemplateRow } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

type Props = {
  templateKey: string;
  templateLabel: string;
  description: string | null;
  row: NotificationTemplateRow | null;
  channel: NotificationChannel;
  canEdit: boolean;
  onSaved: () => void;
};

function parseParamLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinParamLines(values: string[]): string {
  return values.join("\n");
}

export function NotificationTemplateEditor({
  templateKey,
  templateLabel,
  description,
  row,
  channel,
  canEdit,
  onSaved,
}: Props) {
  const definition = getTemplateDefinition(templateKey);
  const [isPending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(row?.is_active ?? true);
  const [subjectTemplate, setSubjectTemplate] = useState(row?.subject_template ?? "");
  const [bodyTemplate, setBodyTemplate] = useState(row?.body_template ?? "");
  const [bodyTemplateHtml, setBodyTemplateHtml] = useState(row?.body_template_html ?? "");
  const [whatsappProviderTemplateName, setWhatsappProviderTemplateName] = useState(
    row?.whatsapp_provider_template_name ?? ""
  );
  const [whatsappParamMappingText, setWhatsappParamMappingText] = useState(
    joinParamLines(row?.whatsapp_param_mapping ?? [])
  );

  const whatsappParamMapping = useMemo(
    () => parseParamLines(whatsappParamMappingText),
    [whatsappParamMappingText]
  );

  const isDirty = useMemo(() => {
    if (!row) return true;
    return (
      isActive !== row.is_active ||
      subjectTemplate !== (row.subject_template ?? "") ||
      bodyTemplate !== row.body_template ||
      bodyTemplateHtml !== (row.body_template_html ?? "") ||
      whatsappProviderTemplateName !== (row.whatsapp_provider_template_name ?? "") ||
      joinParamLines(row.whatsapp_param_mapping) !== whatsappParamMappingText
    );
  }, [
    bodyTemplate,
    bodyTemplateHtml,
    isActive,
    row,
    subjectTemplate,
    whatsappParamMappingText,
    whatsappProviderTemplateName,
  ]);

  const insertToken = (token: string, target: "subject" | "body" | "html" | "wa-param") => {
    if (target === "subject") setSubjectTemplate((current) => `${current}${token}`);
    if (target === "body") setBodyTemplate((current) => `${current}${token}`);
    if (target === "html") setBodyTemplateHtml((current) => `${current}${token}`);
    if (target === "wa-param") setWhatsappParamMappingText((current) => `${current}${token}\n`);
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveNotificationTemplate({
        templateKey,
        channel,
        subjectTemplate: channel === "EMAIL" ? subjectTemplate : null,
        bodyTemplate,
        bodyTemplateHtml: channel === "EMAIL" ? bodyTemplateHtml : null,
        whatsappProviderTemplateName:
          channel === "WHATSAPP" ? whatsappProviderTemplateName : null,
        whatsappParamMapping: channel === "WHATSAPP" ? whatsappParamMapping : [],
        isActive,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(`${templateLabel} ${channel.toLowerCase()} template saved.`);
      onSaved();
    });
  };

  const handleReset = () => {
    startTransition(async () => {
      const result = await resetNotificationTemplate({ templateKey, channel });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Template reset to system default.");
      onSaved();
    });
  };

  if (!row) {
    return (
      <OrgSettingsSection title={`${templateLabel} · ${channel}`} description={description ?? undefined}>
        <p className="text-sm text-muted-foreground">
          Template not available yet. Deploy the notification templates migration, then refresh
          this page.
        </p>
      </OrgSettingsSection>
    );
  }

  return (
    <OrgSettingsSection
      title={`${templateLabel} · ${channel}`}
      description={description ?? definition?.description}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={isActive}
              disabled={!canEdit || isPending}
              onCheckedChange={setIsActive}
              id={`${templateKey}-${channel}-active`}
            />
            <Label htmlFor={`${templateKey}-${channel}-active`} className="text-sm">
              Channel enabled
            </Label>
          </div>
          {canEdit ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending || !row.is_customized}
                onClick={handleReset}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset default
              </Button>
              <Button type="button" size="sm" disabled={!isDirty || isPending} onClick={handleSave}>
                {isPending ? "Saving…" : "Save template"}
              </Button>
            </div>
          ) : null}
        </div>

        {channel === "EMAIL" ? (
          <div className="grid gap-2">
            <Label htmlFor={`${templateKey}-subject`}>Subject</Label>
            <Input
              id={`${templateKey}-subject`}
              value={subjectTemplate}
              disabled={!canEdit || isPending}
              onChange={(event) => setSubjectTemplate(event.target.value)}
            />
            <NotificationMergeFieldChips
              disabled={!canEdit || isPending}
              onInsert={(token) => insertToken(token, "subject")}
            />
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor={`${templateKey}-body`}>
            {channel === "WHATSAPP" ? "Body reference text" : "Body"}
          </Label>
          <textarea
            id={`${templateKey}-body`}
            rows={channel === "SMS" ? 4 : 6}
            disabled={!canEdit || isPending}
            value={bodyTemplate}
            onChange={(event) => setBodyTemplate(event.target.value)}
            className={cn(
              "min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
              "ring-offset-background placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          />
          <NotificationMergeFieldChips
            disabled={!canEdit || isPending}
            onInsert={(token) => insertToken(token, "body")}
          />
        </div>

        {channel === "EMAIL" ? (
          <div className="grid gap-2">
            <Label htmlFor={`${templateKey}-html`}>HTML body (optional)</Label>
            <textarea
              id={`${templateKey}-html`}
              rows={6}
              disabled={!canEdit || isPending}
              value={bodyTemplateHtml}
              onChange={(event) => setBodyTemplateHtml(event.target.value)}
              className={cn(
                "min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs",
                "ring-offset-background placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            />
            <NotificationMergeFieldChips
              disabled={!canEdit || isPending}
              onInsert={(token) => insertToken(token, "html")}
            />
          </div>
        ) : null}

        {channel === "WHATSAPP" ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor={`${templateKey}-wa-name`}>WhatsApp provider template name</Label>
              <Input
                id={`${templateKey}-wa-name`}
                value={whatsappProviderTemplateName}
                disabled={!canEdit || isPending}
                onChange={(event) => setWhatsappProviderTemplateName(event.target.value)}
                placeholder="aib_approval_action_required"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Maps to a pre-approved Meta WhatsApp template. Free-text is not sent on WhatsApp —
                only numbered parameters below.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${templateKey}-wa-params`}>Parameter mapping (one per line)</Label>
              <textarea
                id={`${templateKey}-wa-params`}
                rows={4}
                disabled={!canEdit || isPending}
                value={whatsappParamMappingText}
                onChange={(event) => setWhatsappParamMappingText(event.target.value)}
                className={cn(
                  "min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs",
                  "ring-offset-background placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              />
              <NotificationMergeFieldChips
                disabled={!canEdit || isPending}
                onInsert={(token) => insertToken(token, "wa-param")}
              />
            </div>
          </>
        ) : null}

        <NotificationTemplatePreview
          channel={channel}
          subjectTemplate={subjectTemplate}
          bodyTemplate={bodyTemplate}
          bodyTemplateHtml={bodyTemplateHtml}
          whatsappProviderTemplateName={whatsappProviderTemplateName}
          whatsappParamMapping={whatsappParamMapping}
        />
      </div>
    </OrgSettingsSection>
  );
}
