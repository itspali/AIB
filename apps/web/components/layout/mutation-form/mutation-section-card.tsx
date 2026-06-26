"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
};

/** Glass section card inside mutation forms and item detail views. */
export function MutationSectionCard({ children, className, title, description }: Props) {
  return (
    <section className={cn("surface-panel space-y-3", className)}>
      {title ? (
        <div className="space-y-0.5">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
