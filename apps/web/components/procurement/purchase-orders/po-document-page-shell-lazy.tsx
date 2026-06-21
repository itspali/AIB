"use client";

import dynamic from "next/dynamic";
import { PoCatalogPageSkeleton } from "@/components/procurement/purchase-orders/po-catalog-page-skeleton";
import type { PoDocumentPageShellProps } from "@/components/procurement/purchase-orders/po-document-page-shell";

const PoDocumentPageShell = dynamic(
  () =>
    import("@/components/procurement/purchase-orders/po-document-page-shell").then(
      (module) => module.PoDocumentPageShell
    ),
  { ssr: false, loading: () => <PoCatalogPageSkeleton /> }
);

export function PoDocumentPageShellLazy(props: PoDocumentPageShellProps) {
  return <PoDocumentPageShell {...props} />;
}
