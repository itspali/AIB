"use client";

import type { LucideIcon } from "lucide-react";
import { useLinkStatus } from "next/link";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  className?: string;
};

/** Swaps a Lucide icon for a spinner while the parent `<Link>` transition is pending. */
export function LinkPendingIcon({ icon: Icon, className }: Props) {
  const { pending } = useLinkStatus();
  if (pending) {
    return <Spinner className={className} />;
  }
  return <Icon className={className} aria-hidden />;
}
