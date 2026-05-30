"use client";

import { useEffect, useState } from "react";
import {
  DESKTOP_MIN_WIDTH_PX,
  readDeviceClassFromViewportWidth,
  TABLET_MIN_WIDTH_PX,
  type DeviceClass,
} from "@/lib/layout/device-class";

export type { DeviceClass };

function readDeviceClass(): DeviceClass {
  if (typeof window === "undefined") return "desktop";
  return readDeviceClassFromViewportWidth(window.innerWidth);
}

export function useDeviceClass(): {
  deviceClass: DeviceClass;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
} {
  // Keep SSR and first client render aligned; sync to viewport after mount.
  const [deviceClass, setDeviceClass] = useState<DeviceClass>("desktop");

  useEffect(() => {
    const tabletMedia = window.matchMedia(`(min-width: ${TABLET_MIN_WIDTH_PX}px)`);
    const desktopMedia = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`);

    const sync = () => {
      setDeviceClass(readDeviceClass());
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
