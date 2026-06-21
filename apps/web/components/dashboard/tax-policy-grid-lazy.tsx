"use client";

import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import type { TaxRateSlabRow } from "@/lib/dashboard/types";

const TaxPolicyGrid = lazyClientExport(
  () => import("@/components/dashboard/tax-policy-grid"),
  "TaxPolicyGrid"
);

type Props = {
  rows: TaxRateSlabRow[];
};

export function TaxPolicyGridLazy({ rows }: Props) {
  return <TaxPolicyGrid rows={rows} />;
}
