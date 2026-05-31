"use client";

import { Pencil } from "lucide-react";
import { LinkPendingIcon } from "@/components/ui/link-pending-icon";

export function ProductFormEditLinkContent() {
  return (
    <>
      <LinkPendingIcon icon={Pencil} className="h-4 w-4" />
      Edit
    </>
  );
}
