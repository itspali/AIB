"use client";

import type { LucideIcon } from "lucide-react";
import { useLinkStatus } from "next/link";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type ModuleLinkProps = {
  icon: LucideIcon;
  label: React.ReactNode;
  showLabel?: boolean;
  iconClassName?: string;
  labelClassName?: string;
};

/** Icon + label content for module nav links; icon becomes a spinner while pending. */
export function NavModuleLinkContent({
  icon: Icon,
  label,
  showLabel = true,
  iconClassName,
  labelClassName,
}: ModuleLinkProps) {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending ? (
        <Spinner className={cn("size-4", iconClassName)} />
      ) : (
        <Icon className={cn("size-4 shrink-0", iconClassName)} aria-hidden />
      )}
      {showLabel ? (
        <span className={cn(pending && "opacity-80", labelClassName)}>{label}</span>
      ) : null}
    </>
  );
}

type TextLinkProps = {
  children: React.ReactNode;
  className?: string;
};

/** Text-only nav link content with a leading spinner while pending. */
export function NavTextLinkContent({ children, className }: TextLinkProps) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={cn("inline-flex items-center gap-2", pending && "opacity-80", className)}
      aria-busy={pending || undefined}
    >
      {pending ? <Spinner className="size-3.5 border-[1.5px]" /> : null}
      {children}
    </span>
  );
}
