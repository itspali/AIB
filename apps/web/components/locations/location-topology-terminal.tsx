"use client";

import { useState } from "react";
import { DomRoutingConfigCard } from "@/components/locations/dom-routing-config-card";
import { LocationGovernanceBanner } from "@/components/locations/location-governance-banner";
import { LocationModuleHeader } from "@/components/locations/location-module-header";
import { LocationTopologyExplorer } from "@/components/locations/location-topology-explorer";
import type { DomRoutingConfig } from "@/lib/locations/dom-routing";
import type { LocationModuleContext, LocationRow, LocationTopologyRow } from "@/lib/locations/types";

type Props = {
  topologyRows: LocationTopologyRow[];
  locationRows: LocationRow[];
  domRouting: DomRoutingConfig;
  moduleContext: LocationModuleContext;
};

export function LocationTopologyTerminal({
  topologyRows,
  locationRows,
  domRouting,
  moduleContext,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <LocationModuleHeader activeTab="topology" />
      <LocationGovernanceBanner governance={moduleContext.governance} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <LocationTopologyExplorer
            rows={topologyRows}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <div className="lg:col-span-5">
          <DomRoutingConfigCard
            initialConfig={domRouting}
            locations={locationRows}
            canManage={moduleContext.canManage}
          />
        </div>
      </div>
    </>
  );
}
