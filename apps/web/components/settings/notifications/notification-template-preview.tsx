"use client";

import { useMemo } from "react";
import {
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DOMAIN_LABELS,
  NOTIFICATION_MERGE_FIELDS,
  groupTemplatesByDomain,
} from "@/lib/notifications/template-catalog";
import {
  estimateSmsSegments,
  listUnknownMergeFields,
  renderNotificationTemplate,
} from "@/lib/notifications/render-template";
import type { NotificationChannel, NotificationTemplateRow } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

type Props = {
  channel: NotificationChannel;
  subjectTemplate: string;
  bodyTemplate: string;
  bodyTemplateHtml: string;
  whatsappProviderTemplateName: string;
  whatsappParamMapping: string[];
  className?: string;
};

export function NotificationTemplatePreview({
  channel,
  subjectTemplate,
  bodyTemplate,
  bodyTemplateHtml,
  whatsappProviderTemplateName,
  whatsappParamMapping,
  className,
}: Props) {
  const renderedSubject = useMemo(
    () => renderNotificationTemplate(subjectTemplate),
    [subjectTemplate]
  );
  const renderedBody = useMemo(() => renderNotificationTemplate(bodyTemplate), [bodyTemplate]);
  const renderedHtml = useMemo(
    () => renderNotificationTemplate(bodyTemplateHtml),
    [bodyTemplateHtml]
  );
  const unknownFields = useMemo(
    () => listUnknownMergeFields(`${subjectTemplate}\n${bodyTemplate}\n${bodyTemplateHtml}`),
    [subjectTemplate, bodyTemplate, bodyTemplateHtml]
  );
  const smsStats = useMemo(() => estimateSmsSegments(renderedBody), [renderedBody]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
        {channel === "EMAIL" ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Subject preview
              </p>
              <p className="mt-1 text-sm font-medium">{renderedSubject || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Plain-text preview
              </p>
              <pre className="mt-1 whitespace-pre-wrap font-sans text-sm">{renderedBody || "—"}</pre>
            </div>
            {bodyTemplateHtml.trim() ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  HTML preview
                </p>
                <div
                  className="prose prose-sm mt-2 max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {channel === "SMS" ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              SMS preview
            </p>
            <pre className="whitespace-pre-wrap rounded-md border border-border bg-background p-3 font-sans text-sm">
              {renderedBody || "—"}
            </pre>
            <p className="text-xs text-muted-foreground">
              {smsStats.length} characters · {smsStats.segments} segment
              {smsStats.segments === 1 ? "" : "s"}
            </p>
          </div>
        ) : null}

        {channel === "WHATSAPP" ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Provider template
              </p>
              <p className="mt-1 font-mono text-sm">
                {whatsappProviderTemplateName || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Param mapping preview
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {whatsappParamMapping.length ? (
                  whatsappParamMapping.map((param, index) => (
                    <li key={`${param}-${index}`}>{renderNotificationTemplate(param)}</li>
                  ))
                ) : (
                  <li className="list-none pl-0 text-muted-foreground">No parameters mapped.</li>
                )}
              </ol>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Body reference
              </p>
              <pre className="mt-1 whitespace-pre-wrap font-sans text-sm text-muted-foreground">
                {renderedBody || "—"}
              </pre>
            </div>
          </div>
        ) : null}
      </div>

      {unknownFields.length > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Unknown merge fields: {unknownFields.join(", ")}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Preview uses sample data. Delivery providers are not connected yet — templates are stored for
        future Email, SMS, and WhatsApp dispatch.
      </p>
    </div>
  );
}

export function NotificationMergeFieldChips({
  onInsert,
  disabled = false,
}: {
  onInsert: (token: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {NOTIFICATION_MERGE_FIELDS.map((field) => (
        <button
          key={field.key}
          type="button"
          disabled={disabled}
          title={field.description ?? field.label}
          className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          onClick={() => onInsert(`{{${field.key}}}`)}
        >
          {`{{${field.key}}}`}
        </button>
      ))}
    </div>
  );
}

export function NotificationChannelStatusBadge({
  row,
}: {
  row: NotificationTemplateRow | null;
}) {
  if (!row) {
    return (
      <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground">
        Not seeded
      </span>
    );
  }

  if (!row.is_active) {
    return (
      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
        Disabled
      </span>
    );
  }

  if (row.is_customized) {
    return (
      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
        Customized
      </span>
    );
  }

  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
      Default
    </span>
  );
}

export function notificationChannelLabel(channel: NotificationChannel): string {
  return NOTIFICATION_CHANNEL_LABELS[channel];
}

export function notificationDomainLabel(
  domain: keyof typeof NOTIFICATION_DOMAIN_LABELS
): string {
  return NOTIFICATION_DOMAIN_LABELS[domain];
}

export const notificationChannels = NOTIFICATION_CHANNELS;
