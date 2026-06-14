import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityEntityType, ActivityTimelineEvent } from "@/lib/activity/types";

function parseDetail(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as Record<string, unknown>;
}

export async function fetchEntityActivityTimeline(
  supabase: SupabaseClient,
  entityType: ActivityEntityType,
  entityId: string,
  options?: { limit?: number; before?: string | null }
): Promise<ActivityTimelineEvent[]> {
  const { data, error } = await supabase.rpc("fetch_entity_activity_timeline", {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_limit: options?.limit ?? 50,
    p_before: options?.before ?? null,
  });

  if (error) throw new Error(error.message);

  if (!Array.isArray(data)) return [];

  return data.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: String(record.id),
      event_kind: String(record.event_kind ?? ""),
      event_code: String(record.event_code ?? ""),
      title: String(record.title ?? ""),
      detail: parseDetail(record.detail),
      actor_id: typeof record.actor_id === "string" ? record.actor_id : null,
      actor_name: typeof record.actor_name === "string" ? record.actor_name : null,
      occurred_at: String(record.occurred_at ?? ""),
    } satisfies ActivityTimelineEvent;
  });
}
