"use client";

import { ArrowLeft } from "lucide-react";
import { LinkPendingIcon } from "@/components/ui/link-pending-icon";

export function ProductFormBackLinkContent({ label = "Back" }: { label?: string }) {
  return (
    <>
      <LinkPendingIcon icon={ArrowLeft} className="h-4 w-4" />
      {label}
    </>
  );
}
