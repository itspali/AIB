"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check } from "lucide-react";
import { toast } from "sonner";
import { switchActiveTenantMembership } from "@/app/settings/enterprise/actions";
import { rowClassName } from "@/components/layout/profile-nav-link";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { WorkspaceMembershipOption } from "@/lib/user/types";

type Props = {
  options: WorkspaceMembershipOption[];
  activeTenantId?: string | null;
  onNavigate: () => void;
};

export function WorkspaceSwitchSubmenu({ options, activeTenantId, onNavigate }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const byGroup = new Map<string | null, WorkspaceMembershipOption[]>();
    for (const option of options) {
      const key = option.groupName ? option.groupId : null;
      const label = option.groupName ?? "Standalone workspaces";
      const bucketKey = key ?? `standalone:${label}`;
      if (!byGroup.has(bucketKey)) byGroup.set(bucketKey, []);
      byGroup.get(bucketKey)!.push(option);
    }
    return [...byGroup.entries()];
  }, [options]);

  const handleSwitch = (tenantId: string) => {
    if (tenantId === activeTenantId) {
      onNavigate();
      return;
    }
    startTransition(async () => {
      const result = await switchActiveTenantMembership(tenantId);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      const supabase = createClient();
      await supabase.auth.refreshSession();
      onNavigate();
      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <div className="py-1">
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Switch workspace
      </div>
      {grouped.map(([groupKey, items]) => (
        <div key={groupKey} className="pb-1">
          {items[0]?.groupName ? (
            <div className="px-3 py-1 text-xs text-muted-foreground">{items[0].groupName}</div>
          ) : null}
          {items.map((option) => {
            const isActive = option.tenantId === activeTenantId;
            return (
              <button
                key={option.tenantId}
                type="button"
                disabled={isPending}
                className={cn(rowClassName, "w-full justify-between", isActive && "bg-muted/60")}
                onClick={() => handleSwitch(option.tenantId)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{option.displayName}</span>
                </span>
                {isActive ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
