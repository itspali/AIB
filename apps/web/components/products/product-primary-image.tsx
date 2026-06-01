import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  imageUrl?: string | null;
  alt?: string;
  size?: "sm" | "md";
  className?: string;
};

export function ProductPrimaryImage({
  imageUrl,
  alt = "",
  size = "md",
  className,
}: Props) {
  const boxClass = size === "sm" ? "h-8 w-8 rounded" : "h-10 w-10 rounded-md";
  const iconClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden bg-muted ring-1 ring-border/60",
        boxClass,
        className
      )}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <Package className={cn(iconClass, "text-muted-foreground")} aria-hidden />
      )}
    </span>
  );
}
