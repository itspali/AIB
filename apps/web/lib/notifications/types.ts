export type NotificationChannel = "EMAIL" | "SMS" | "WHATSAPP";

export type NotificationDocumentDomain = "PROCUREMENT" | "SALES" | "CREDIT";

export type NotificationTemplateRow = {
  id: string;
  tenant_id: string;
  template_key: string;
  channel: NotificationChannel;
  locale: string;
  event_code: string;
  document_domain: NotificationDocumentDomain;
  label: string;
  description: string | null;
  subject_template: string | null;
  body_template: string;
  body_template_html: string | null;
  whatsapp_provider_template_name: string | null;
  whatsapp_param_mapping: string[];
  is_active: boolean;
  is_customized: boolean;
  created_at: string;
  updated_at: string;
};

export type NotificationTemplateGroup = {
  templateKey: string;
  eventCode: string;
  documentDomain: NotificationDocumentDomain;
  label: string;
  description: string | null;
  channels: Record<NotificationChannel, NotificationTemplateRow | null>;
};

export type SaveNotificationTemplateInput = {
  templateKey: string;
  channel: NotificationChannel;
  locale?: string;
  subjectTemplate?: string | null;
  bodyTemplate: string;
  bodyTemplateHtml?: string | null;
  whatsappProviderTemplateName?: string | null;
  whatsappParamMapping?: string[];
  isActive?: boolean;
};
