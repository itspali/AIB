"use client";

import Link from "next/link";
import { SETTINGS_ROUTES } from "@/lib/settings/navigation";
import { AlertTriangle } from "lucide-react";
import type { WorkspaceDeletionStatus } from "@/lib/organization/deletion";
import { formatDateTime } from "@/lib/dashboard/format";

type Props = {
  deletion: WorkspaceDeletionStatus;
};

export function WorkspaceDeletionBanner({ deletion }: Props) {
  return (
    <div
      className="border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-foreground"
      role="status"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
          <span>
            This workspace is scheduled for deletion on{" "}
            <span className="font-medium">{formatDateTime(deletion.scheduledPurgeAt)}</span>.
            It is read-only until then.
          </span>
        </p>
        <Link
          href={`${SETTINGS_ROUTES.company}#org-section-entities`}
          className="font-medium text-destructive underline-offset-4 hover:underline"
        >
          Cancel deletion
        </Link>
      </div>
    </div>
  );
}
