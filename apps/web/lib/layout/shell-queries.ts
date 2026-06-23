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
  return useQuery({
    queryKey: shellQueryKeys.operatorProfile,
    queryFn: fetchOperatorProfileAction,
    enabled: Boolean(tenantId) && !impersonating,
    initialData: serverProfile ?? undefined,
    staleTime: OPERATOR_PROFILE_STALE_MS,
  });
}

export function useShellApprovalAlertCount(showModuleNav: boolean) {
  return useQuery({
    queryKey: shellQueryKeys.approvalAlertCount,
    queryFn: fetchApprovalAlertCountAction,
    enabled: showModuleNav,
    staleTime: APPROVAL_ALERT_STALE_MS,
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
