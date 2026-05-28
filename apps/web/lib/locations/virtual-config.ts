export const VIRTUAL_FULFILLMENT_MODES = [
  "NEAREST_BY_POSTAL_CODE",
  "CENTRAL_FALLBACK_ENFORCED",
  "SPLIT_ORDER_PERMITTED",
] as const;

export type VirtualFulfillmentMode = (typeof VIRTUAL_FULFILLMENT_MODES)[number];

export const WEBHOOK_VERIFICATION_STATUSES = ["UNVERIFIED", "PENDING", "VERIFIED"] as const;

export type WebhookVerificationStatus = (typeof WEBHOOK_VERIFICATION_STATUSES)[number];

export type VirtualLocationConfiguration = {
  fulfillment_assignment_mode: VirtualFulfillmentMode;
  digital_safety_stock_buffer: number;
  channel_webhook_sync_url: string;
  default_revenue_clearing_account_id: string | null;
  webhook_verification_status: WebhookVerificationStatus;
};

export type RevenueAccountOption = {
  id: string;
  account_code: string;
  account_name: string;
};

export const DEFAULT_VIRTUAL_LOCATION_CONFIG: VirtualLocationConfiguration = {
  fulfillment_assignment_mode: "NEAREST_BY_POSTAL_CODE",
  digital_safety_stock_buffer: 0,
  channel_webhook_sync_url: "",
  default_revenue_clearing_account_id: null,
  webhook_verification_status: "UNVERIFIED",
};

export function virtualFulfillmentModeLabel(mode: VirtualFulfillmentMode): string {
  switch (mode) {
    case "NEAREST_BY_POSTAL_CODE":
      return "Nearest fulfillment by postal code";
    case "CENTRAL_FALLBACK_ENFORCED":
      return "Central fallback enforced";
    case "SPLIT_ORDER_PERMITTED":
      return "Split order permitted";
    default:
      return mode;
  }
}

export function webhookVerificationLabel(status: WebhookVerificationStatus): string {
  switch (status) {
    case "VERIFIED":
      return "Verified";
    case "PENDING":
      return "Pending";
    default:
      return "Unverified";
  }
}

export function parseVirtualLocationConfiguration(raw: unknown): VirtualLocationConfiguration {
  const root =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const configurationMetadata =
    root.configuration_metadata && typeof root.configuration_metadata === "object"
      ? (root.configuration_metadata as Record<string, unknown>)
      : root;
  const virtual =
    configurationMetadata.virtual && typeof configurationMetadata.virtual === "object"
      ? (configurationMetadata.virtual as Record<string, unknown>)
      : {};

  const mode = virtual.fulfillment_assignment_mode;
  const bufferRaw = virtual.digital_safety_stock_buffer;
  const url = virtual.channel_webhook_sync_url;
  const accountId = virtual.default_revenue_clearing_account_id;
  const verification = virtual.webhook_verification_status;

  const parsedBuffer =
    typeof bufferRaw === "number"
      ? bufferRaw
      : typeof bufferRaw === "string"
        ? Number(bufferRaw)
        : 0;

  return {
    fulfillment_assignment_mode: VIRTUAL_FULFILLMENT_MODES.includes(
      mode as VirtualFulfillmentMode
    )
      ? (mode as VirtualFulfillmentMode)
      : DEFAULT_VIRTUAL_LOCATION_CONFIG.fulfillment_assignment_mode,
    digital_safety_stock_buffer:
      Number.isFinite(parsedBuffer) && parsedBuffer >= 0 ? Math.trunc(parsedBuffer) : 0,
    channel_webhook_sync_url: typeof url === "string" ? url : "",
    default_revenue_clearing_account_id:
      typeof accountId === "string" && accountId ? accountId : null,
    webhook_verification_status: WEBHOOK_VERIFICATION_STATUSES.includes(
      verification as WebhookVerificationStatus
    )
      ? (verification as WebhookVerificationStatus)
      : DEFAULT_VIRTUAL_LOCATION_CONFIG.webhook_verification_status,
  };
}

export function buildVirtualConfigurationMetadataPatch(
  config: VirtualLocationConfiguration
): Record<string, unknown> {
  return {
    configuration_metadata: {
      virtual: {
        fulfillment_assignment_mode: config.fulfillment_assignment_mode,
        digital_safety_stock_buffer: config.digital_safety_stock_buffer,
        channel_webhook_sync_url: config.channel_webhook_sync_url.trim(),
        default_revenue_clearing_account_id: config.default_revenue_clearing_account_id,
        webhook_verification_status: config.webhook_verification_status,
      },
    },
  };
}
