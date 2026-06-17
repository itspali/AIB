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
  minHeight: string;
  label: string;
};

export function presentationPagePreviewDimensions(
  size: PresentationPageSize,
  orientation: PresentationPageOrientation = "portrait"
): PresentationPagePreviewDimensions {
  const portrait =
    size === "LETTER"
      ? { width: "8.5in", minHeight: "11in", label: "US Letter" }
      : { width: "210mm", minHeight: "297mm", label: "A4" };

  if (orientation === "landscape") {
    return {
      width: portrait.minHeight,
      minHeight: portrait.width,
      label: portrait.label,
    };
  }

  return portrait;
}
