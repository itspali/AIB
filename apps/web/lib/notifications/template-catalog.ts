import type { NotificationChannel, NotificationDocumentDomain } from "@/lib/notifications/types";

export type NotificationTemplateDefinition = {
  templateKey: string;
  eventCode: string;
  documentDomain: NotificationDocumentDomain;
  label: string;
  description: string;
  groupLabel: string;
};

export const NOTIFICATION_CHANNELS: NotificationChannel[] = ["EMAIL", "SMS", "WHATSAPP"];

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
};

export const NOTIFICATION_DOMAIN_LABELS: Record<NotificationDocumentDomain, string> = {
  PROCUREMENT: "Procurement",
  SALES: "Sales",
  CREDIT: "Credit control",
};

export const NOTIFICATION_TEMPLATE_DEFINITIONS: NotificationTemplateDefinition[] = [
  {
    templateKey: "approval.po.submitted",
    eventCode: "approval.submitted",
    documentDomain: "PROCUREMENT",
    groupLabel: "Purchase order approval",
    label: "Submitted (confirmation)",
    description: "Sent to the submitter when a purchase order is submitted for approval.",
  },
  {
    templateKey: "approval.po.step_opened",
    eventCode: "approval.step_opened",
    documentDomain: "PROCUREMENT",
    groupLabel: "Purchase order approval",
    label: "Approval required",
    description: "Sent to assignees when a purchase order approval step opens.",
  },
  {
    templateKey: "approval.po.approved",
    eventCode: "approval.approved",
    documentDomain: "PROCUREMENT",
    groupLabel: "Purchase order approval",
    label: "Fully approved",
    description: "Sent when a purchase order approval run is fully approved.",
  },
  {
    templateKey: "approval.po.rejected",
    eventCode: "approval.rejected",
    documentDomain: "PROCUREMENT",
    groupLabel: "Purchase order approval",
    label: "Rejected",
    description: "Sent when a purchase order approval is rejected.",
  },
  {
    templateKey: "approval.po.reminder",
    eventCode: "approval.reminder",
    documentDomain: "PROCUREMENT",
    groupLabel: "Purchase order approval",
    label: "Reminder",
    description: "Reminder for pending purchase order approvers.",
  },
  {
    templateKey: "approval.sales_order.submitted",
    eventCode: "approval.submitted",
    documentDomain: "SALES",
    groupLabel: "Sales order approval",
    label: "Submitted (confirmation)",
    description: "Sent to the submitter when a sales order is submitted for approval.",
  },
  {
    templateKey: "approval.sales_order.step_opened",
    eventCode: "approval.step_opened",
    documentDomain: "SALES",
    groupLabel: "Sales order approval",
    label: "Approval required",
    description: "Sent to assignees when a sales order approval step opens.",
  },
  {
    templateKey: "approval.sales_order.approved",
    eventCode: "approval.approved",
    documentDomain: "SALES",
    groupLabel: "Sales order approval",
    label: "Fully approved",
    description: "Sent when a sales order approval run is fully approved.",
  },
  {
    templateKey: "approval.sales_order.rejected",
    eventCode: "approval.rejected",
    documentDomain: "SALES",
    groupLabel: "Sales order approval",
    label: "Rejected",
    description: "Sent when a sales order approval is rejected.",
  },
  {
    templateKey: "approval.sales_order.reminder",
    eventCode: "approval.reminder",
    documentDomain: "SALES",
    groupLabel: "Sales order approval",
    label: "Reminder",
    description: "Reminder for pending sales order approvers.",
  },
  {
    templateKey: "credit_hold.release_requested",
    eventCode: "credit_hold.release_requested",
    documentDomain: "CREDIT",
    groupLabel: "Credit hold",
    label: "Release requested",
    description: "Sent when a sales order on credit hold needs manager release.",
  },
  {
    templateKey: "credit_hold.released",
    eventCode: "credit_hold.released",
    documentDomain: "CREDIT",
    groupLabel: "Credit hold",
    label: "Released",
    description: "Sent when a manager releases a sales order from credit hold.",
  },
];

export type NotificationMergeField = {
  key: string;
  label: string;
  example: string;
  description?: string;
};

export const NOTIFICATION_MERGE_FIELDS: NotificationMergeField[] = [
  { key: "tenant.name", label: "Tenant name", example: "AIB Global" },
  { key: "tenant.trade_name", label: "Trade name", example: "AIB" },
  { key: "document.type_label", label: "Document type", example: "Purchase order" },
  { key: "document.number", label: "Document number", example: "PO-2026-00482" },
  { key: "document.amount", label: "Amount", example: "62,400.00" },
  { key: "document.currency", label: "Currency", example: "INR" },
  { key: "document.url", label: "Document link", example: "https://app.example/po/00482" },
  { key: "party.name", label: "Supplier / party", example: "Acme Supplies" },
  { key: "customer.name", label: "Customer", example: "Northwind Retail" },
  { key: "submitter.name", label: "Submitter", example: "Alice Kumar" },
  { key: "submitter.email", label: "Submitter email", example: "alice@example.com" },
  { key: "approver.name", label: "Approver", example: "Bob Singh" },
  { key: "workflow.level_current", label: "Current level", example: "2" },
  { key: "workflow.level_total", label: "Total levels", example: "3" },
  { key: "workflow.step_label", label: "Step label", example: "Finance (ANY)" },
  { key: "workflow.quorum", label: "Quorum", example: "ANY" },
  { key: "decision.notes", label: "Decision notes", example: "Budget approved for Q3." },
  { key: "sla.due_at", label: "SLA due", example: "14 Jun 2026, 18:00" },
  { key: "credit.limit", label: "Credit limit", example: "100,000.00" },
  { key: "credit.projected_balance", label: "Projected balance", example: "112,500.00" },
];

export function getTemplateDefinition(templateKey: string): NotificationTemplateDefinition | null {
  return NOTIFICATION_TEMPLATE_DEFINITIONS.find((row) => row.templateKey === templateKey) ?? null;
}

export function groupTemplatesByDomain(
  definitions: NotificationTemplateDefinition[]
): Record<NotificationDocumentDomain, NotificationTemplateDefinition[]> {
  return definitions.reduce(
    (acc, definition) => {
      acc[definition.documentDomain].push(definition);
      return acc;
    },
    {
      PROCUREMENT: [] as NotificationTemplateDefinition[],
      SALES: [] as NotificationTemplateDefinition[],
      CREDIT: [] as NotificationTemplateDefinition[],
    }
  );
}
