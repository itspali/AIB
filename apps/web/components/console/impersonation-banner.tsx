"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { endImpersonation } from "@/lib/console/actions/impersonation";
import { Button } from "@/components/ui/button";

type Props = {
  tenantName: string;
  organizationCode: string | null;
  mode: "READ_ONLY" | "WRITE";
};

function ExitImpersonationButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
      {pending ? "Exiting…" : "Exit impersonation"}
    </Button>
  );
}

export function ImpersonationBanner({ tenantName, organizationCode, mode }: Props) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-950 dark:text-amber-100">
      <p>
        Viewing <span className="font-semibold">{tenantName}</span>
        {organizationCode ? ` (${organizationCode})` : ""} — {mode === "READ_ONLY" ? "read-only" : "write"}{" "}
        impersonation
      </p>
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/console">Back to console</Link>
        </Button>
        <form action={endImpersonation} className="inline">
          <ExitImpersonationButton />
        </form>
      </div>
    </div>
  );
}
