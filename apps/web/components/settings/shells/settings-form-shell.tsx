"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Sticky header + scrollable body for long settings forms (company, enterprise, access). */
export function SettingsFormShell({ title, description, actions, children, className }: Props) {
  return (
    <div className={cn("canvas-scroll-endpad flex flex-col gap-4 lg:gap-5", className)}>
      <div className="settings-glass-sticky-header sticky top-0 z-30 -mx-4 flex flex-wrap items-start justify-between gap-3 py-3 md:-mx-6 md:px-6">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold sm:text-xl">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
