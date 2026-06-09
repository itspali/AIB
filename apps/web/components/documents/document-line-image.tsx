import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  imageUrl: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
};

const SIZE_CLASS = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
} as const;

/** Compact product thumbnail for document line grids (PO, GRN, etc.). */
export function DocumentLineImage({ imageUrl, size = "sm", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded border border-border/60 bg-muted",
        SIZE_CLASS[size],
        className
      )}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="eager" decoding="async" />
      ) : (
        <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
      )}
    </span>
  );
}
