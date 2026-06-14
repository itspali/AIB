"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Circle } from "lucide-react";
import { loadEntityActivityTimeline } from "@/lib/activity/actions";
import {
  resolveActivityEventDescription,
  resolveActivityEventLabel,
} from "@/lib/activity/event-catalog";
import type { ActivityEntityType, ActivityTimelineEvent } from "@/lib/activity/types";
import { Button } from "@/components/ui/button";
import { useDeviceClass } from "@/hooks/use-device-class";
import { formatDate } from "@/lib/dashboard/format";
import type { PostingStepResult } from "@/lib/documents/posting-types";
import { cn } from "@/lib/utils";

type Props = {
  entityType: ActivityEntityType;
  entityId: string;
  refreshKey?: number | string;
  className?: string;
};

function formatActivityTimestamp(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function parsePostingSteps(detail: Record<string, unknown>): PostingStepResult[] {
  const raw = detail.steps;
  if (!Array.isArray(raw)) return [];
  const steps: PostingStepResult[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : null;
    const status = row.status;
    if (
      !id ||
      (status !== "success" &&
        status !== "failure" &&
        status !== "skipped" &&
        status !== "not_run")
    ) {
      continue;
    }
    steps.push({
      id,
      status,
      detail: typeof row.detail === "string" ? row.detail : null,
    });
  }
  return steps;
}

function ActivityTimelineRow({ event }: { event: ActivityTimelineEvent }) {
  const label = resolveActivityEventLabel(event.event_code, event.title);
  const description = resolveActivityEventDescription(event.event_code, event.title, event.detail);
  const steps = parsePostingSteps(event.detail);

  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <Circle className="size-2.5 shrink-0 fill-primary text-primary" aria-hidden />
        <span className="mt-1 w-px flex-1 bg-border" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 -mt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-sm font-medium">{label}</p>
          <time className="text-xs text-muted-foreground" dateTime={event.occurred_at}>
            {formatActivityTimestamp(event.occurred_at)}
          </time>
        </div>
        <p className="text-xs text-muted-foreground">
          {event.actor_name?.trim() ? event.actor_name : "System"}
        </p>
        {description ? (
          <p className="mt-1 text-xs text-foreground/80">{description}</p>
        ) : null}
        {steps.length > 0 ? (
          <ul className="mt-2 space-y-1 rounded-md border border-border/60 bg-background/60 p-2">
            {steps.map((step) => (
              <li key={step.id} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">{step.id.replaceAll("_", " ")}</span>
                {" · "}
                {step.status.replaceAll("_", " ")}
                {step.detail ? ` — ${step.detail}` : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

export function DocumentActivityTimelinePanel({
  entityType,
  entityId,
  refreshKey,
  className,
}: Props) {
  const { isMobile } = useDeviceClass();
  const [expanded, setExpanded] = useState(!isMobile);
  const [events, setEvents] = useState<ActivityTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadTimeline = useCallback(
    async (before?: ActivityTimelineEvent | null, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      const result = await loadEntityActivityTimeline(
        entityType,
        entityId,
        before
          ? { occurred_at: before.occurred_at, sequence_no: before.sequence_no }
          : null
      );
      if ("error" in result) {
        setError(result.error);
        if (!append) setEvents([]);
      } else {
        setEvents((current) => (append ? [...current, ...result.events] : result.events));
        setHasMore(result.events.length >= 50);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [entityId, entityType]
  );

  useEffect(() => {
    if (!expanded) return;
    void loadTimeline();
  }, [entityId, entityType, expanded, loadTimeline, refreshKey]);

  useEffect(() => {
    setExpanded(!isMobile);
  }, [isMobile]);

  const oldestEvent = events.at(-1) ?? null;

  return (
    <section
      className={cn("rounded-lg border border-border bg-muted/20", className)}
      aria-label="Activity timeline"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Activity</h3>
          <p className="text-xs text-muted-foreground">
            Who did what on this document, newest first.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 px-2"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? (
            <ChevronUp className="size-4" aria-hidden />
          ) : (
            <ChevronDown className="size-4" aria-hidden />
          )}
          <span className="sr-only">{expanded ? "Collapse activity" : "Expand activity"}</span>
        </Button>
      </div>

      {expanded ? (
        <div className="border-t border-border px-4 py-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading activity…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <>
              <ol className="relative">
                {events.map((event) => (
                  <ActivityTimelineRow key={event.id} event={event} />
                ))}
              </ol>
              {hasMore ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-auto px-0 text-xs text-muted-foreground"
                  disabled={loadingMore}
                  onClick={() => void loadTimeline(oldestEvent, true)}
                >
                  {loadingMore ? "Loading…" : "Load older activity"}
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
