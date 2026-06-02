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

/** Keeps module nav icons pinned while labels collapse. */
export const navIconSlotClass = "flex size-4 shrink-0 items-center justify-center";

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
      <span className={navIconSlotClass}>
        {pending ? (
          <Spinner className={cn("size-4", iconClassName)} />
        ) : (
          <Icon className={cn("size-4 shrink-0", iconClassName)} aria-hidden />
        )}
      </span>
      <span
        aria-hidden={!showLabel}
        className={cn(
          "min-w-0 truncate transition-[opacity,width] duration-200 ease-in-out",
          showLabel ? "w-auto opacity-100" : "w-0 overflow-hidden opacity-0",
          pending && showLabel && "opacity-80",
          labelClassName
        )}
      >
        {label}
      </span>
    </>
  );
}

type TextLinkProps = {
  children: React.ReactNode;
  className?: string;
  icon?: LucideIcon;
  iconClassName?: string;
};

/** Nav link label with optional icon; icon becomes a spinner while pending. */
export function NavTextLinkContent({
  children,
  className,
  icon: Icon,
  iconClassName,
}: TextLinkProps) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-2", pending && "opacity-80", className)}
      aria-busy={pending || undefined}
    >
      {pending ? (
        <Spinner className={cn("size-4 shrink-0", iconClassName)} />
      ) : Icon ? (
        <Icon className={cn("size-4 shrink-0 text-muted-foreground", iconClassName)} aria-hidden />
      ) : null}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
