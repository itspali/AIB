"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { APPROVAL_ALERT_CHANGED_EVENT } from "@/lib/layout/approval-alert-events";
import { fetchApprovalAlertCountAction, fetchOperatorProfileAction } from "@/lib/layout/shell-actions";
import type { OperatorProfile } from "@/lib/user/types";

export const shellQueryKeys = {
  operatorProfile: ["shell", "operatorProfile"] as const,
  approvalAlertCount: ["shell", "approvalAlertCount"] as const,
};

const OPERATOR_PROFILE_STALE_MS = 60_000;
const APPROVAL_ALERT_STALE_MS = 30_000;

/** Cached across workspace navigations so the shell does not refetch on every route change. */
export function useShellOperatorProfile(
  tenantId: string | null | undefined,
  impersonating: boolean,
  serverProfile: OperatorProfile | null | undefined
) {
  const hasServerProfile = serverProfile != null;

  return useQuery({
    queryKey: shellQueryKeys.operatorProfile,
    queryFn: fetchOperatorProfileAction,
    enabled: Boolean(tenantId) && !impersonating,
    initialData: serverProfile ?? undefined,
    initialDataUpdatedAt: hasServerProfile ? Date.now() : undefined,
    staleTime: OPERATOR_PROFILE_STALE_MS,
    refetchOnMount: hasServerProfile ? false : true,
  });
}

export function useShellApprovalAlertCount(
  showModuleNav: boolean,
  serverCount?: number
) {
  const hasServerCount = serverCount != null;

  return useQuery({
    queryKey: shellQueryKeys.approvalAlertCount,
    queryFn: fetchApprovalAlertCountAction,
    enabled: showModuleNav,
    initialData: hasServerCount ? serverCount : undefined,
    initialDataUpdatedAt: hasServerCount ? Date.now() : undefined,
    staleTime: APPROVAL_ALERT_STALE_MS,
    refetchOnMount: hasServerCount ? false : true,
  });
}

export function useApprovalAlertInvalidation(showModuleNav: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!showModuleNav) return;

    const onChange = () => {
      void queryClient.invalidateQueries({ queryKey: shellQueryKeys.approvalAlertCount });
    };

    window.addEventListener(APPROVAL_ALERT_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(APPROVAL_ALERT_CHANGED_EVENT, onChange);
  }, [queryClient, showModuleNav]);
}
