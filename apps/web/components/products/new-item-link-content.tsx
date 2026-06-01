"use client";

import { Plus } from "lucide-react";
import { LinkPendingIcon } from "@/components/ui/link-pending-icon";

export function NewItemLinkContent() {
  return (
    <>
      <LinkPendingIcon icon={Plus} className="h-3.5 w-3.5" />
      New
    </>
  );
}
