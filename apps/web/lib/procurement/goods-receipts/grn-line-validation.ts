export type GrnAcceptRejectLine = {
  variant_sku?: string;
  quantity_received: string;
  quantity_accepted: string;
  quantity_rejected: string;
};

export function parseGrnQuantity(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
}

export function validateGrnAcceptRejectLines(lines: GrnAcceptRejectLine[]): string | null {
  for (const line of lines) {
    const received = parseGrnQuantity(line.quantity_received);
    const accepted = parseGrnQuantity(line.quantity_accepted);
    const rejected = parseGrnQuantity(line.quantity_rejected);
    const label = line.variant_sku?.trim() || "a line";

    if (!Number.isFinite(received) || received <= 0) {
      continue;
    }

    if (!Number.isFinite(accepted) || !Number.isFinite(rejected)) {
      return `Enter valid non-negative accepted and rejected quantities for ${label}.`;
    }

    const total = accepted + rejected;
    if (Math.abs(total - received) > 0.0001) {
      return `Accepted plus rejected must equal received quantity on ${label} (${received}).`;
    }
  }

  return null;
}

export function defaultGrnAcceptRejectForReceived(received: string): {
  quantity_accepted: string;
  quantity_rejected: string;
} {
  return {
    quantity_accepted: received,
    quantity_rejected: "0",
  };
}

export function syncGrnAcceptRejectOnReceivedChange(
  line: GrnAcceptRejectLine,
  nextReceived: string
): Pick<GrnAcceptRejectLine, "quantity_received" | "quantity_accepted" | "quantity_rejected"> {
  const prevReceived = parseGrnQuantity(line.quantity_received);
  const prevAccepted = parseGrnQuantity(line.quantity_accepted);
  const prevRejected = parseGrnQuantity(line.quantity_rejected);

  const wasFullyAccepted =
    Number.isFinite(prevReceived) &&
    Number.isFinite(prevAccepted) &&
    Number.isFinite(prevRejected) &&
    prevRejected === 0 &&
    Math.abs(prevAccepted - prevReceived) < 0.0001;

  if (wasFullyAccepted) {
    return {
      quantity_received: nextReceived,
      ...defaultGrnAcceptRejectForReceived(nextReceived),
    };
  }

  return { quantity_received: nextReceived };
}
