import type {
  PresentationPageOrientation,
  PresentationPageSize,
} from "@/lib/documents/print/types";

export type PresentationPageSizeOption = {
  value: PresentationPageSize;
  label: string;
};

export const PRESENTATION_PAGE_SIZE_OPTIONS: PresentationPageSizeOption[] = [
  { value: "A4", label: "A4" },
  { value: "LETTER", label: "US Letter" },
];

export type PresentationPagePreviewDimensions = {
  width: string;
  height: string;
  aspectRatio: number;
  label: string;
};

export function presentationPagePreviewDimensions(
  size: PresentationPageSize,
  orientation: PresentationPageOrientation = "portrait"
): PresentationPagePreviewDimensions {
  const portrait =
    size === "LETTER"
      ? { width: "8.5in", height: "11in", label: "US Letter", aspectRatio: 8.5 / 11 }
      : { width: "210mm", height: "297mm", label: "A4", aspectRatio: 210 / 297 };

  if (orientation === "landscape") {
    return {
      width: portrait.height,
      height: portrait.width,
      label: portrait.label,
      aspectRatio: 1 / portrait.aspectRatio,
    };
  }

  return portrait;
}
