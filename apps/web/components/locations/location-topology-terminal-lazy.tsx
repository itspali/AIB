"use client";

import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import type { LocationTopologyTerminalProps } from "@/components/locations/location-topology-terminal";

const LocationTopologyTerminal = lazyClientExport(
  () => import("@/components/locations/location-topology-terminal"),
  "LocationTopologyTerminal"
);

export function LocationTopologyTerminalLazy(props: LocationTopologyTerminalProps) {
  return <LocationTopologyTerminal {...props} />;
}
