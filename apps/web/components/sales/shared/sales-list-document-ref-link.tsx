"use client";

import Link from "next/link";

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
      className="font-mono text-xs text-primary hover:underline"
      onClick={(event) => event.stopPropagation()}
    >
      {trimmed}
    </Link>
  );
}
