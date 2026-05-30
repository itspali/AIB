/** Viewport tier for record-list layout prefs and responsive column sizing. */
export type DeviceClass = "mobile" | "tablet" | "desktop";

export const DEVICE_CLASSES: readonly DeviceClass[] = ["mobile", "tablet", "desktop"];

/** Matches `use-device-class` and Tailwind `md` / `lg` breakpoints. */
export const TABLET_MIN_WIDTH_PX = 768;
export const DESKTOP_MIN_WIDTH_PX = 1024;

export function readDeviceClassFromViewportWidth(width: number): DeviceClass {
  if (width >= DESKTOP_MIN_WIDTH_PX) return "desktop";
  if (width >= TABLET_MIN_WIDTH_PX) return "tablet";
  return "mobile";
}
