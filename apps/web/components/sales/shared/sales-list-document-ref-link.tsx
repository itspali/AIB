"use client";

import Link from "next/link";
import { LIST_TABLE_CELL_MONO_REF } from "@/lib/layout/list-table-chrome";
import { cn } from "@/lib/utils";

type Props = {
  documentId: string | null | undefined;
  documentNumber: string | null | undefined;
  moduleHref: string;
};

export function SalesListDocumentRefLink({
  documentId,
  documentNumber,
  moduleHref,
}: Props) {
  const trimmed = documentNumber?.trim();
  if (!documentId || !trimmed) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <Link
      href={`${moduleHref}?id=${encodeURIComponent(documentId)}`}
      className={cn(LIST_TABLE_CELL_MONO_REF, "text-primary hover:underline")}
      onClick={(event) => event.stopPropagation()}
    >
      {trimmed}
    </Link>
  );
}
