"use client";

import type { SalesOrderAddressBlock } from "@/lib/sales/orders/address-blocks";
import { cn } from "@/lib/utils";

type Props = {
  blocks: SalesOrderAddressBlock[];
  className?: string;
  compact?: boolean;
};

function AddressBlockCard({
  block,
  compact,
}: {
  block: SalesOrderAddressBlock;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p
        className={cn(
          "font-medium uppercase tracking-wide text-muted-foreground",
          compact ? "text-[10px]" : "text-xs"
        )}
      >
        {block.title}
      </p>
      <p className={cn("font-medium text-foreground", compact ? "text-xs" : "text-sm")}>
        {block.name}
      </p>
      {block.lines.map((line) => (
        <p
          key={`${block.kind}-${line}`}
          className={cn("text-muted-foreground", compact ? "text-xs leading-snug" : "text-sm leading-snug")}
        >
          {line}
        </p>
      ))}
      {block.tax_identifier ? (
        <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          Tax ID: {block.tax_identifier}
        </p>
      ) : null}
    </div>
  );
}

export function SoAddressBlocks({ blocks, className, compact = false }: Props) {
  if (blocks.length === 0) return null;

  return (
    <div
      className={cn(
        "grid gap-4",
        blocks.length > 1 ? "sm:grid-cols-2" : "grid-cols-1",
        className
      )}
    >
      {blocks.map((block) => (
        <AddressBlockCard key={block.kind} block={block} compact={compact} />
      ))}
    </div>
  );
}
