"use client";

import { useEffect, useState } from "react";
import type { DeviceClass } from "@/lib/products/list-prefs";

export type { DeviceClass };

const TABLET_MEDIA = "(min-width: 768px)";
const DESKTOP_MEDIA = "(min-width: 1024px)";

function readDeviceClass(): DeviceClass {
  if (typeof window === "undefined") return "desktop";
  if (window.matchMedia(DESKTOP_MEDIA).matches) return "desktop";
  if (window.matchMedia(TABLET_MEDIA).matches) return "tablet";
  return "mobile";
}

export function useDeviceClass(): {
  deviceClass: DeviceClass;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
} {
  const [deviceClass, setDeviceClass] = useState<DeviceClass>(() => readDeviceClass());

  useEffect(() => {
    const tabletMedia = window.matchMedia(TABLET_MEDIA);
    const desktopMedia = window.matchMedia(DESKTOP_MEDIA);

    const sync = () => {
      if (desktopMedia.matches) {
        setDeviceClass("desktop");
      } else if (tabletMedia.matches) {
        setDeviceClass("tablet");
      } else {
        setDeviceClass("mobile");
      }
    };

    sync();
    tabletMedia.addEventListener("change", sync);
    desktopMedia.addEventListener("change", sync);
    return () => {
      tabletMedia.removeEventListener("change", sync);
      desktopMedia.removeEventListener("change", sync);
    };
  }, []);

  return {
    deviceClass,
    isMobile: deviceClass === "mobile",
    isTablet: deviceClass === "tablet",
    isDesktop: deviceClass === "desktop",
  };
}
