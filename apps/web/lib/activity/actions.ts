"use server";

import { createClient } from "@/lib/supabase/server";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import { fetchEntityActivityTimeline } from "@/lib/activity/queries";
import type {
  ActivityEntityType,
  ActivityTimelineCursor,
  ActivityTimelineEvent,
} from "@/lib/activity/types";

export async function loadEntityActivityTimeline(
  entityType: ActivityEntityType,
  entityId: string,
  before?: ActivityTimelineCursor | null
): Promise<{ events: ActivityTimelineEvent[] } | { error: string }> {
  try {
    const { supabase } = await requireTenantId();
    const events = await fetchEntityActivityTimeline(supabase, entityType, entityId, {
      before,
    });
    return { events };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to load activity timeline.",
    };
  }
}
