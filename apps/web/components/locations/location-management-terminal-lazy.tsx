"use client";

import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import type { LocationManagementTerminalProps } from "@/components/locations/location-management-terminal";

const LocationManagementTerminal = lazyClientExport(
  () => import("@/components/locations/location-management-terminal"),
  "LocationManagementTerminal"
);

export function LocationManagementTerminalLazy(props: LocationManagementTerminalProps) {
  return <LocationManagementTerminal {...props} />;
}
