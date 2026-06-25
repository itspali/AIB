"use client";

import { Package } from "lucide-react";
import {
  GLASS_V2_LIST_IMAGE,
  GLASS_V2_LIST_IMAGE_PLACEHOLDER,
} from "@/lib/layout/list-module-chrome";
import type { ProductListRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";

type Props = {
  product: ProductListRow;
  onImageClick?: (product: ProductListRow) => void;
  size?: "table" | "card";
  className?: string;
};

const SIZE_CLASS = {
  table: "h-8 w-8",
  card: "h-14 w-14 sm:h-16 sm:w-16",
} as const;

export function ProductListItemImage({
  product,
  onImageClick,
  size = "table",
  className,
}: Props) {
  const frameClass = SIZE_CLASS[size];
  const imageUrl = product.image_url?.trim() || null;

  if (imageUrl && onImageClick) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onImageClick(product);
        }}
        className={cn(
          GLASS_V2_LIST_IMAGE,
          "cursor-zoom-in transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          frameClass,
          className
        )}
        aria-label={`View images for ${product.name}`}
      >
        <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      </button>
    );
  }

  if (imageUrl) {
    return (
      <span
        className={cn(GLASS_V2_LIST_IMAGE, frameClass, className)}
      >
        <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        GLASS_V2_LIST_IMAGE,
        GLASS_V2_LIST_IMAGE_PLACEHOLDER,
        frameClass,
        className
      )}
      aria-label={`No image for ${product.name}`}
      role="img"
    >
      <Package className={size === "table" ? "h-4 w-4" : "h-5 w-5 sm:h-6 sm:w-6"} aria-hidden />
    </span>
  );
}
