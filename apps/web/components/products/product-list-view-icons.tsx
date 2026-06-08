import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

type IconProps = SVGProps<SVGSVGElement>;

/** Two horizontal cards stacked vertically (horizontal row card layout). */
export function HorizontalCardsStackedIcon({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("h-4 w-4 shrink-0", className)}
      {...props}
    >
      <rect x="2" y="2.25" width="12" height="4.25" rx="0.75" />
      <rect x="2" y="9.5" width="12" height="4.25" rx="0.75" />
    </svg>
  );
}

/** Two portrait cards side by side (shop catalog grid). */
export function ShopCardsRowIcon({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("h-4 w-4 shrink-0", className)}
      {...props}
    >
      <rect x="2" y="3" width="5" height="10" rx="0.75" />
      <rect x="9" y="3" width="5" height="10" rx="0.75" />
    </svg>
  );
}
