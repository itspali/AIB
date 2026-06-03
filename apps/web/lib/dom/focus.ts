/** Clear focus so Radix modal layers do not leave it on aria-hidden ancestors. */
export function blurActiveElement(): void {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) {
    active.blur();
  }
}
