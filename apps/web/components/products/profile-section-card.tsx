"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Card section shell shared by item profile summary and profile-layout editor. */
export function ProfileSectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "rounded-lg border-border/70 bg-card/70 shadow-none",
        className
      )}
    >
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-sm font-semibold leading-none">{title}</CardTitle>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-0 px-4 pb-4 pt-0">{children}</CardContent>
    </Card>
  );
}
