import { cn } from "@/lib/utils";

export type MeasureContentWidthOptions = {
  texts: readonly string[];
  referenceElement?: HTMLElement | null;
  className?: string;
  paddingPx: number;
  extraPx?: number;
};

function measureSingleLineTextWidth(
  text: string,
  referenceElement: HTMLElement | null | undefined,
  className: string
): number {
  if (typeof document === "undefined") return 0;

  const span = document.createElement("span");
  span.className = className;
  span.style.cssText =
    "position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;top:-9999px;left:-9999px";
  if (referenceElement) {
    const computed = getComputedStyle(referenceElement);
    span.style.font = computed.font;
    span.style.letterSpacing = computed.letterSpacing;
  }
  span.textContent = text;
  document.body.appendChild(span);
  const width = span.offsetWidth;
  document.body.removeChild(span);
  return width;
}

export function measureMaxContentWidth({
  texts,
  referenceElement,
  className = "text-sm",
  paddingPx,
  extraPx = 0,
}: MeasureContentWidthOptions): number {
  if (typeof document === "undefined" || texts.length === 0) {
    return paddingPx + extraPx;
  }

  let maxContent = 0;
  for (const text of texts) {
    if (!text) continue;
    maxContent = Math.max(
      maxContent,
      measureSingleLineTextWidth(text, referenceElement, className)
    );
  }

  return maxContent + paddingPx + extraPx;
}

export function resolveMeasureClassName(options: {
  mono?: boolean;
  tabular?: boolean;
}): string {
  return cn(
    "text-sm",
    options.tabular && "tabular-nums",
    options.mono && "font-mono text-xs"
  );
}
