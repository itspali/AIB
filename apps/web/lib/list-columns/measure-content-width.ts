import { cn } from "@/lib/utils";

export type MeasureContentWidthOptions = {
  texts: readonly string[];
  referenceElement?: HTMLElement | null;
  /** Prefer header label/cell typography (ignores body measure classes). */
  typographyElement?: HTMLElement | null;
  className?: string;
  paddingPx: number;
  extraPx?: number;
};

const HEADER_LABEL_SELECTOR = ".matrix-table__header-label";

export function resolveHeaderLabelTypographyElement(
  headerElement?: HTMLElement | null
): HTMLElement | null | undefined {
  if (!headerElement) return headerElement;
  return headerElement.querySelector<HTMLElement>(HEADER_LABEL_SELECTOR) ?? headerElement;
}

function applyTypographyFromElement(span: HTMLSpanElement, element: HTMLElement) {
  const computed = getComputedStyle(element);
  span.style.fontFamily = computed.fontFamily;
  span.style.fontSize = computed.fontSize;
  span.style.fontWeight = computed.fontWeight;
  span.style.letterSpacing = computed.letterSpacing;
  span.style.textTransform = computed.textTransform;
  span.style.fontVariantNumeric = computed.fontVariantNumeric;
}

function measureSingleLineTextWidth(
  text: string,
  options: {
    typographyElement?: HTMLElement | null;
    referenceElement?: HTMLElement | null;
    className?: string;
  }
): number {
  if (typeof document === "undefined") return 0;

  const span = document.createElement("span");
  span.style.cssText =
    "position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;top:-9999px;left:-9999px";

  if (options.typographyElement) {
    applyTypographyFromElement(span, options.typographyElement);
  } else {
    if (options.className) {
      span.className = options.className;
    }
    if (options.referenceElement) {
      const computed = getComputedStyle(options.referenceElement);
      span.style.font = computed.font;
      span.style.letterSpacing = computed.letterSpacing;
      span.style.textTransform = computed.textTransform;
    }
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
  typographyElement,
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
      measureSingleLineTextWidth(text, {
        typographyElement,
        referenceElement: typographyElement ? undefined : referenceElement,
        className: typographyElement ? undefined : className,
      })
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
