import { NOTIFICATION_MERGE_FIELDS } from "@/lib/notifications/template-catalog";

export type NotificationTemplatePreviewContext = Record<string, string>;

export const NOTIFICATION_PREVIEW_SAMPLE_CONTEXT: NotificationTemplatePreviewContext = {
  "tenant.name": "AIB Global",
  "tenant.trade_name": "AIB",
  "document.type_label": "Purchase order",
  "document.number": "PO-2026-00482",
  "document.amount": "62,400.00",
  "document.currency": "INR",
  "document.url": "https://app.example.com/procurement/purchase-orders?id=sample",
  "party.name": "Acme Supplies",
  "customer.name": "Northwind Retail",
  "submitter.name": "Alice Kumar",
  "submitter.email": "alice@example.com",
  "approver.name": "Bob Singh",
  "workflow.level_current": "2",
  "workflow.level_total": "3",
  "workflow.step_label": "Finance (ANY)",
  "workflow.quorum": "ANY",
  "decision.notes": "Approved within Q3 budget.",
  "sla.due_at": "14 Jun 2026, 18:00",
  "credit.limit": "100,000.00",
  "credit.projected_balance": "112,500.00",
};

const MERGE_TOKEN_PATTERN = /\{\{\s*([a-z0-9_.]+)\s*\}\}/gi;

export function renderNotificationTemplate(
  template: string | null | undefined,
  context: NotificationTemplatePreviewContext = NOTIFICATION_PREVIEW_SAMPLE_CONTEXT
): string {
  if (!template) return "";

  return template.replace(MERGE_TOKEN_PATTERN, (_match, rawKey: string) => {
    const key = rawKey.trim();
    return context[key] ?? `{{${key}}}`;
  });
}

export function listUnknownMergeFields(template: string): string[] {
  const known = new Set(NOTIFICATION_MERGE_FIELDS.map((field) => field.key));
  const unknown = new Set<string>();

  for (const match of template.matchAll(MERGE_TOKEN_PATTERN)) {
    const key = match[1]?.trim();
    if (key && !known.has(key)) {
      unknown.add(key);
    }
  }

  return [...unknown];
}

export function estimateSmsSegments(text: string): { length: number; segments: number } {
  const length = text.length;
  const segments = length <= 160 ? 1 : Math.ceil(length / 153);
  return { length, segments };
}

export function parseWhatsappParamMapping(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === "string");
}
