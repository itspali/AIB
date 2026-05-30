"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  fetchProductMediaGallery,
  type ProductListGallerySlide,
} from "@/app/items/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
  itemName: string | null;
};

export function ProductListImageGallery({
  open,
  onOpenChange,
  itemId,
  itemName,
}: Props) {
  const [slides, setSlides] = useState<ProductListGallerySlide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const cacheKeyRef = useRef("");
  const slidesCacheRef = useRef<ProductListGallerySlide[]>([]);

  const loadSlides = useCallback(async () => {
    if (!itemId || !itemName) return [];

    const cacheKey = itemId;
    if (cacheKeyRef.current === cacheKey && slidesCacheRef.current.length) {
      setSlides(slidesCacheRef.current);
      return slidesCacheRef.current;
    }

    setIsLoading(true);
    try {
      const result = await fetchProductMediaGallery(itemId, itemName);
      cacheKeyRef.current = cacheKey;
      slidesCacheRef.current = result.slides;
      setSlides(result.slides);
      return result.slides;
    } catch {
      toast.error("Unable to load image gallery.");
      setSlides([]);
      slidesCacheRef.current = [];
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [itemId, itemName]);

  useEffect(() => {
    if (!open || !itemId) return;

    setActiveIndex(0);
    void loadSlides().then((loadedSlides) => {
      if (!loadedSlides.length) {
        toast.info("This item has no uploaded images.");
        onOpenChange(false);
      }
    });
  }, [itemId, loadSlides, onOpenChange, open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((current) => (current > 0 ? current - 1 : current));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex((current) =>
          current < slides.length - 1 ? current + 1 : current
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, slides.length]);

  const activeSlide = slides[activeIndex] ?? null;
  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < slides.length - 1;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Product image gallery</DialogPrimitive.Title>

          <div className="flex items-center justify-between px-4 py-3 text-white">
            <div className="min-w-0">
              {activeSlide ? (
                <>
                  <p className="truncate text-sm font-medium">{activeSlide.itemName}</p>
                  <p className="text-xs text-white/70">
                    Image {activeIndex + 1} of {slides.length}
                  </p>
                </>
              ) : (
                <p className="text-sm text-white/70">Loading gallery…</p>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 shrink-0 p-0 text-white hover:bg-white/10 hover:text-white"
                aria-label="Close gallery"
              >
                <X className="h-5 w-5" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-14">
            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-white/80" aria-hidden />
            ) : activeSlide ? (
              <img
                src={activeSlide.url}
                alt={activeSlide.itemName}
                className="max-h-[min(72vh,900px)] max-w-full object-contain"
              />
            ) : null}

            {canGoPrev ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute left-3 top-1/2 h-10 w-10 -translate-y-1/2 p-0 text-white hover:bg-white/10 hover:text-white"
                aria-label="Previous image"
                onClick={() => setActiveIndex((current) => current - 1)}
              >
                <ChevronLeft className="h-7 w-7" />
              </Button>
            ) : null}

            {canGoNext ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-3 top-1/2 h-10 w-10 -translate-y-1/2 p-0 text-white hover:bg-white/10 hover:text-white"
                aria-label="Next image"
                onClick={() => setActiveIndex((current) => current + 1)}
              >
                <ChevronRight className="h-7 w-7" />
              </Button>
            ) : null}
          </div>

          {slides.length > 1 ? (
            <div className="border-t border-white/10 px-4 py-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {slides.map((slide, index) => (
                  <button
                    key={slide.mediaId}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      "relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                      index === activeIndex
                        ? "border-white"
                        : "border-transparent opacity-70 hover:opacity-100"
                    )}
                    aria-label={`View image ${index + 1}`}
                    aria-current={index === activeIndex ? "true" : undefined}
                  >
                    <img
                      src={slide.url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
