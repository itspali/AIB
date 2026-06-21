"use client";

import dynamic from "next/dynamic";
import { SoCatalogPageSkeleton } from "@/components/sales/orders/so-catalog-page-skeleton";
import type { SoDocumentPageShellProps } from "@/components/sales/orders/so-document-page-shell";

const SoDocumentPageShell = dynamic(
  () =>
    import("@/components/sales/orders/so-document-page-shell").then(
      (module) => module.SoDocumentPageShell
    ),
  { ssr: false, loading: () => <SoCatalogPageSkeleton /> }
);

export function SoDocumentPageShellLazy(props: SoDocumentPageShellProps) {
  return <SoDocumentPageShell {...props} />;
}
