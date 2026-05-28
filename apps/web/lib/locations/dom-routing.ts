export const DOM_FULFILLMENT_STRATEGIES = [
  "NEAREST_BRANCH_ZIP",
  "CENTRAL_FALLBACK_CDC",
] as const;

export type DomFulfillmentStrategy = (typeof DOM_FULFILLMENT_STRATEGIES)[number];

export type DomRoutingConfig = {
  primary_fulfillment_strategy: DomFulfillmentStrategy;
  central_fallback_location_id: string | null;
  local_branch_safety_threshold: number;
};

export const DEFAULT_DOM_ROUTING_CONFIG: DomRoutingConfig = {
  primary_fulfillment_strategy: "NEAREST_BRANCH_ZIP",
  central_fallback_location_id: null,
  local_branch_safety_threshold: 0,
};

export function domStrategyLabel(strategy: DomFulfillmentStrategy): string {
  switch (strategy) {
    case "NEAREST_BRANCH_ZIP":
      return "Nearest Branch First via Zip Proximity";
    case "CENTRAL_FALLBACK_CDC":
      return "Enforce Central Fallback via Delhi CDC";
    default:
      return strategy;
  }
}

export function parseDomRoutingConfig(
  raw: unknown,
  centralHqLocationId: string | null = null
): DomRoutingConfig {
  const config = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const strategy = config.primary_fulfillment_strategy;
  const thresholdRaw = config.local_branch_safety_threshold;
  const fallback = config.central_fallback_location_id;

  const parsedThreshold =
    typeof thresholdRaw === "number"
      ? thresholdRaw
      : typeof thresholdRaw === "string"
        ? Number(thresholdRaw)
        : 0;

  return {
    primary_fulfillment_strategy:
      strategy === "CENTRAL_FALLBACK_CDC" ? "CENTRAL_FALLBACK_CDC" : "NEAREST_BRANCH_ZIP",
    central_fallback_location_id:
      typeof fallback === "string" && fallback
        ? fallback
        : centralHqLocationId,
    local_branch_safety_threshold:
      Number.isFinite(parsedThreshold) && parsedThreshold >= 0 ? parsedThreshold : 0,
  };
}

export function buildDomRoutingPatch(config: DomRoutingConfig): Record<string, unknown> {
  return {
    dom_routing: {
      primary_fulfillment_strategy: config.primary_fulfillment_strategy,
      central_fallback_location_id: config.central_fallback_location_id,
      local_branch_safety_threshold: config.local_branch_safety_threshold,
    },
  };
}
