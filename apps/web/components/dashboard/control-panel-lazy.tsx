"use client";

import { lazyClientExport } from "@/lib/lazy/lazy-client-export";

const ControlPanel = lazyClientExport(
  () => import("@/components/dashboard/control-panel"),
  "ControlPanel"
);

export function ControlPanelLazy() {
  return <ControlPanel />;
}
