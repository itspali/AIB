export const ACTIVITY_ENTITY_TYPES = [
  "PURCHASE_ORDER",
  "GOODS_RECEIPT",
  "PURCHASE_INVOICE",
  "GOODS_IN_TRANSIT",
  "STOCK_ADJUSTMENT",
  "STOCK_TRANSFER",
  "SALES_ORDER",
  "SALES_INVOICE",
] as const;

export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export type ActivityTimelineEvent = {
  id: string;
  event_kind: string;
  event_code: string;
  title: string;
  detail: Record<string, unknown>;
  actor_id: string | null;
  actor_name: string | null;
  occurred_at: string;
  sequence_no: number;
};

export type ActivityTimelineCursor = {
  occurred_at: string;
  sequence_no: number;
};
