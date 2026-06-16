"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Circle } from "lucide-react";
import {
  PostingStepStatusIcon,
  postingStepStatusLabel,
} from "@/components/documents/document-posting-summary-panel";
import { loadEntityActivityTimeline } from "@/lib/activity/actions";
import {
  resolveActivityEventDescription,
  resolveActivityEventLabel,
} from "@/lib/activity/event-catalog";
import type { ActivityEntityType, ActivityTimelineEvent } from "@/lib/activity/types";
import { Button } from "@/components/ui/button";
import { useDeviceClass } from "@/hooks/use-device-class";
import { resolvePostingStepDefinition } from "@/lib/documents/posting-step-catalog";
import {
  countNotApplicablePostingSteps,
  resolveVisiblePostingSteps,
} from "@/lib/documents/posting-step-visibility";
import type { PostingStepResult } from "@/lib/documents/posting-types";
import { cn } from "@/lib/utils";

type Props = {
  entityType: ActivityEntityType;
  entityId: string;
  refreshKey?: number | string;
  className?: string;
  /** collapsible: inline section with expand/collapse; pane: dedicated peek pane */
  presentation?: "collapsible" | "pane";
  /** When false, skip fetching (rail tab not selected). Defaults to true. */
  active?: boolean;
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

function milestoneDrawerToggleLabel(stepCount: number, expanded: boolean): string {
  const noun = stepCount === 1 ? "milestone" : "milestones";
  return expanded ? "Hide milestone details" : `Show ${stepCount} ${noun}`;
}

function activityMilestoneSummary(steps: PostingStepResult[]): string {
  const applicable = steps.filter(
    (step) => step.status !== "skipped" && step.status !== "not_run"
  );
  if (applicable.length === 0) {
    return `${steps.length} system ${steps.length === 1 ? "step" : "steps"}`;
  }
  const failed = applicable.filter((step) => step.status === "failure").length;
  if (failed > 0) {
    return `${failed} failed · ${applicable.length} ${applicable.length === 1 ? "milestone" : "milestones"}`;
  }
  return `${applicable.length} ${applicable.length === 1 ? "milestone" : "milestones"} completed`;
}

function ActivityEventMilestoneDrawer({
  event,
  steps,
}: {
  event: ActivityTimelineEvent;
  steps: PostingStepResult[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [showNotApplicable, setShowNotApplicable] = useState(false);
  const description = resolveActivityEventDescription(event.event_code, event.title, event.detail);
  const notApplicableCount = countNotApplicablePostingSteps(steps);
  const visibleSteps = resolveVisiblePostingSteps(steps, showNotApplicable);

  if (steps.length === 0 && !description) return null;

  const drawerLabel =
    steps.length > 0
      ? milestoneDrawerToggleLabel(steps.length, expanded)
      : expanded
        ? "Hide details"
        : "Show details";

  return (
    <div className="mt-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto gap-1 px-0 py-0.5 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? (
          <ChevronUp className="size-3.5 shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="size-3.5 shrink-0" aria-hidden />
        )}
        {drawerLabel}
        {!expanded && steps.length > 0 ? (
          <span className="text-muted-foreground/80">· {activityMilestoneSummary(steps)}</span>
        ) : null}
      </Button>

      {expanded ? (
        <div className="mt-2 space-y-2 rounded-md border border-border/60 bg-background/60 p-2.5">
          {description ? (
            <p className="text-xs text-foreground/80">{description}</p>
          ) : null}
          {visibleSteps.length > 0 ? (
            <ol className="space-y-2.5">
              {visibleSteps.map((step) => {
                const definition = resolvePostingStepDefinition(step.id);
                return (
                  <li key={step.id} className="flex gap-2.5">
                    <PostingStepStatusIcon status={step.status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p className="text-xs font-medium text-foreground">{definition.label}</p>
                        <span className="text-xs text-muted-foreground">
                          {postingStepStatusLabel(step.status)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{definition.description}</p>
                      {step.detail ? (
                        <p className="mt-0.5 text-xs font-medium text-foreground/80">{step.detail}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : null}
          {notApplicableCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto px-0 py-0.5 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
              aria-expanded={showNotApplicable}
              onClick={() => setShowNotApplicable((current) => !current)}
            >
              {showNotApplicable ? (
                <ChevronUp className="size-3.5 shrink-0" aria-hidden />
              ) : (
                <ChevronDown className="size-3.5 shrink-0" aria-hidden />
              )}
              {showNotApplicable
                ? "Hide not applicable steps"
                : `Show ${notApplicableCount} not applicable ${notApplicableCount === 1 ? "step" : "steps"}`}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ActivityTimelineRow({ event }: { event: ActivityTimelineEvent }) {
  const label = resolveActivityEventLabel(event.event_code, event.title);
  const description = resolveActivityEventDescription(event.event_code, event.title, event.detail);
  const steps = parsePostingSteps(event.detail);
  const showInlineDescription = Boolean(description) && steps.length === 0;

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
        {showInlineDescription ? (
          <p className="mt-1 text-xs text-foreground/80">{description}</p>
        ) : null}
        {steps.length > 0 ? <ActivityEventMilestoneDrawer event={event} steps={steps} /> : null}
      </div>
    </li>
  );
}

function ActivityCollapsedPreview({ events }: { events: ActivityTimelineEvent[] }) {
  if (events.length === 0) return null;

  const latest = events[0]!;
  const latestLabel = resolveActivityEventLabel(latest.event_code, latest.title);
  const latestSteps = parsePostingSteps(latest.detail);
  const stepSummary =
    latestSteps.length > 0 ? ` · ${activityMilestoneSummary(latestSteps)}` : "";

  return (
    <div className="border-t border-border px-4 py-2.5">
      <p className="text-xs text-muted-foreground">
        {events.length} {events.length === 1 ? "event" : "events"} · Latest:{" "}
        <span className="text-foreground/80">{latestLabel}</span>
        {stepSummary}
      </p>
    </div>
  );
}

function ActivityTimelineBody({
  loading,
  loadingMore,
  error,
  events,
  hasMore,
  onLoadMore,
}: {
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  events: ActivityTimelineEvent[];
  hasMore: boolean;
  onLoadMore: () => void;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading activity…</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>;
  }

  return (
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
          onClick={onLoadMore}
        >
          {loadingMore ? "Loading…" : "Load older activity"}
        </Button>
      ) : null}
    </>
  );
}

export function DocumentActivityTimelinePanel({
  entityType,
  entityId,
  refreshKey,
  className,
  presentation = "collapsible",
  active = true,
}: Props) {
  const { isMobile } = useDeviceClass();
  const isPane = presentation === "pane";
  const [expanded, setExpanded] = useState(isPane ? true : !isMobile);
  const [events, setEvents] = useState<ActivityTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const shouldLoad = active;

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
    if (!shouldLoad) return;
    void loadTimeline();
  }, [entityId, entityType, shouldLoad, loadTimeline, refreshKey]);

  useEffect(() => {
    if (isPane) {
      setExpanded(true);
      return;
    }
    setExpanded(!isMobile);
  }, [isMobile, isPane]);

  const oldestEvent = events.at(-1) ?? null;

  if (isPane) {
    return (
      <section className={cn("min-h-0", className)} aria-label="Activity timeline">
        <div className="mb-3 space-y-1">
          <h3 className="text-sm font-semibold">Activity</h3>
          <p className="text-xs text-muted-foreground">
            Who did what on this document, newest first.
          </p>
        </div>
        <ActivityTimelineBody
          loading={loading}
          loadingMore={loadingMore}
          error={error}
          events={events}
          hasMore={hasMore}
          onLoadMore={() => void loadTimeline(oldestEvent, true)}
        />
      </section>
    );
  }

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
          <ActivityTimelineBody
            loading={loading}
            loadingMore={loadingMore}
            error={error}
            events={events}
            hasMore={hasMore}
            onLoadMore={() => void loadTimeline(oldestEvent, true)}
          />
        </div>
      ) : loading ? (
        <div className="border-t border-border px-4 py-2.5">
          <p className="text-xs text-muted-foreground">Loading activity…</p>
        </div>
      ) : error ? (
        <div className="border-t border-border px-4 py-2.5">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      ) : (
        <ActivityCollapsedPreview events={events} />
      )}
    </section>
  );
}
