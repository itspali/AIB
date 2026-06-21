"use client";

import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import type { GettingStartedSnapshot } from "@/lib/dashboard/getting-started";

const GettingStartedChecklist = lazyClientExport(
  () => import("@/components/dashboard/getting-started-checklist"),
  "GettingStartedChecklist"
);

type Props = {
  snapshot: GettingStartedSnapshot;
};

export function GettingStartedChecklistLazy({ snapshot }: Props) {
  return <GettingStartedChecklist snapshot={snapshot} />;
}
