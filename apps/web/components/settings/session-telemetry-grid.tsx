"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { revokeOtherSessions } from "@/app/settings/profile/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSessionActivity } from "@/lib/settings/format-datetime";
import { createClient } from "@/lib/supabase/client";
import type { AuthSessionRow } from "@/lib/settings/types";
import { cn } from "@/lib/utils";

type Props = {
  sessions: AuthSessionRow[];
  timezone: string;
  authSessionId: string | null;
  disabled?: boolean;
};

export function SessionTelemetryGrid({ sessions, timezone, authSessionId, disabled }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRevokeOthers = () => {
    if (!authSessionId) {
      toast.error("Current session could not be identified.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });

      if (signOutError) {
        toast.error(signOutError.message);
        return;
      }

      const result = await revokeOtherSessions(authSessionId);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to revoke other sessions.");
        return;
      }

      toast.success("Alternative sessions terminated successfully");
      router.refresh();
    });
  };

  return (
    <section className="surface-panel space-y-4">
      <div className="flex items-center gap-2">
        <MonitorSmartphone className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Live Session Telemetry</h2>
      </div>

      <div className="surface-inset overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">OS / Browser</th>
              <th className="px-3 py-2 font-medium">IP</th>
              <th className="px-3 py-2 font-medium">Last Activity</th>
              <th className="px-3 py-2 font-medium">State</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  No session telemetry recorded yet. Activity appears after this page loads.
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr
                  key={session.id}
                  className={cn("border-t border-border", session.is_current && "bg-primary/5")}
                >
                  <td className="px-3 py-2">{session.os_browser}</td>
                  <td className="px-3 py-2 font-mono text-xs">{session.ip_address || "—"}</td>
                  <td className="px-3 py-2">
                    {formatSessionActivity(session.last_activity_at, timezone)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={session.is_current ? "active" : "default"}>
                      {session.is_current ? "This device" : "Active"}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={disabled || isPending || sessions.length <= 1}
        onClick={handleRevokeOthers}
      >
        Terminate &amp; Revoke All Alternative Sessions
      </Button>
    </section>
  );
}
