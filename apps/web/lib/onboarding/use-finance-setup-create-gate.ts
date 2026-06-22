"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { OpenModuleDrawerCreateOptions } from "@/lib/layout/use-module-drawer-url";
import { FINANCE_SETUP_REQUIRED_MESSAGE } from "@/lib/onboarding/finance-setup-gate";

type Options = {
  financeSetupComplete: boolean;
  openCreate: (options?: OpenModuleDrawerCreateOptions) => void;
  closeDrawer: () => void;
  drawerSurface: string;
};

export function useFinanceSetupCreateGate({
  financeSetupComplete,
  openCreate,
  closeDrawer,
  drawerSurface,
}: Options) {
  const router = useRouter();

  const notifyBlocked = useCallback(() => {
    toast.error(FINANCE_SETUP_REQUIRED_MESSAGE, {
      action: {
        label: "Complete setup",
        onClick: () => router.push("/onboarding"),
      },
    });
  }, [router]);

  const guardedOpenCreate = useCallback(
    (options?: OpenModuleDrawerCreateOptions) => {
      if (!financeSetupComplete) {
        notifyBlocked();
        return;
      }
      openCreate(options);
    },
    [financeSetupComplete, notifyBlocked, openCreate]
  );

  useEffect(() => {
    if (financeSetupComplete) return;
    if (drawerSurface === "create") {
      closeDrawer();
      notifyBlocked();
    }
  }, [financeSetupComplete, drawerSurface, closeDrawer, notifyBlocked]);

  return guardedOpenCreate;
}
