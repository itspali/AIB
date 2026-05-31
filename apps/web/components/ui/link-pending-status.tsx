"use client";

import { useLinkStatus } from "next/link";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  spinnerClassName?: string;
};

/** Shows a leading spinner and `aria-busy` while the parent `<Link>` transition is pending. */
export function LinkPendingStatus({ children, className, spinnerClassName }: Props) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={cn("inline-flex items-center gap-2", pending && "opacity-80", className)}
      aria-busy={pending || undefined}
    >
      {pending ? <Spinner className={cn("size-3.5 border-[1.5px]", spinnerClassName)} /> : null}
      {children}
    </span>
  );
}
