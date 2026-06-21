"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import type { OperatorProfile } from "@/lib/user/types";

const OmnibarProvider = dynamic(
  () => import("@/components/search/omnibar-provider").then((module) => module.OmnibarProvider),
  { ssr: false }
);

type Props = {
  children: ReactNode;
  operatorProfile?: OperatorProfile | null;
  tenantId?: string | null;
};

export function OmnibarProviderLazy({ children, operatorProfile = null, tenantId = null }: Props) {
  return (
    <OmnibarProvider operatorProfile={operatorProfile} tenantId={tenantId}>
      {children}
    </OmnibarProvider>
  );
}
