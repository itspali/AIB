"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { editorSubsectionHeadingWrapClass } from "@/lib/products/editor-chrome";
import { cn } from "@/lib/utils";

/** Normalized body text for field info popovers (always text-xs). */
export function FieldLabelInfoBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "space-y-1.5 text-xs leading-relaxed text-muted-foreground",
        "[&_p]:text-xs [&_p]:leading-relaxed",
        "[&_li]:text-xs [&_li]:leading-relaxed",
        "[&_strong]:font-medium [&_strong]:text-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}

export function fieldHelpText(text: string) {
  return <p>{text}</p>;
}

export function FieldLabelInfo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          className="inline-flex shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`About ${label}`}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 max-w-[min(18rem,calc(100vw-2rem))] p-2.5 text-xs">
        <FieldLabelInfoBody>{children}</FieldLabelInfoBody>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Combine multiple hint blocks into one popover body. */
export function mergeFieldLabelInfo(
  ...parts: (ReactNode | null | undefined | false)[]
): ReactNode | null {
  const nodes = parts.filter(Boolean);
  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];
  return (
    <>
      {nodes.map((node, index) => (
        <div key={index}>{node}</div>
      ))}
    </>
  );
}

export function SubsectionHeading({
  title,
  info,
  className,
  compact,
}: {
  title: string;
  info?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const wrapClass = compact
    ? cn(
        "flex w-full items-center gap-1.5 bg-transparent px-0 py-0 dark:bg-transparent",
        className
      )
    : editorSubsectionHeadingWrapClass(className);

  return (
    <div className={wrapClass}>
      <h4
        className={cn(
          "font-medium text-foreground",
          compact ? "text-xs" : "text-sm"
        )}
      >
        {title}
      </h4>
      {info ? <FieldLabelInfo label={title}>{info}</FieldLabelInfo> : null}
    </div>
  );
}
