"use client";

import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import type { ApprovalCommandCenterProps } from "@/components/approvals/approval-command-center";

const ApprovalCommandCenter = lazyClientExport(
  () => import("@/components/approvals/approval-command-center"),
  "ApprovalCommandCenter"
);

export function ApprovalCommandCenterLazy(props: ApprovalCommandCenterProps) {
  return <ApprovalCommandCenter {...props} />;
}
