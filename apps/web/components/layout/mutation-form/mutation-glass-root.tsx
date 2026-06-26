"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MUTATION_GLASS_ROOT_CLASS } from "@/lib/layout/list-module-chrome";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Glass V2 scope for catalog mutation drawers and item detail panels. */
export function MutationGlassRoot({ children, className }: Props) {
  return <div className={cn(MUTATION_GLASS_ROOT_CLASS, className)}>{children}</div>;
}
