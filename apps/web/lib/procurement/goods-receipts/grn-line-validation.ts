export type GrnQuantityLine = {
  variant_sku?: string;
  quantity_received: string;
  exception_quantity: string;
};

export function parseGrnQuantity(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
}

export function computeGrnLineQuantities(received: string, exceptionQty: string): {
  quantity_accepted: string;
  quantity_rejected: string;
} {
  const receivedNum = parseGrnQuantity(received);
  const exceptionNum = parseGrnQuantity(exceptionQty || "0");
  if (!Number.isFinite(receivedNum) || !Number.isFinite(exceptionNum)) {
    return { quantity_accepted: "", quantity_rejected: "0" };
  }
  const accepted = Math.max(receivedNum - exceptionNum, 0);
  const format = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/\.?0+$/, "");
  return {
    quantity_accepted: format(accepted),
    quantity_rejected: format(exceptionNum),
  };
}

export function validateGrnExceptionLines(lines: GrnQuantityLine[]): string | null {
  for (const line of lines) {
    const received = parseGrnQuantity(line.quantity_received);
    const exception = parseGrnQuantity(line.exception_quantity || "0");
    const label = line.variant_sku?.trim() || "a line";

    if (!Number.isFinite(received) || received <= 0) {
      continue;
    }

    if (!Number.isFinite(exception)) {
      return `Enter a valid non-negative exception quantity for ${label}.`;
    }

    if (exception > received + 0.0001) {
      return `Exception quantity cannot exceed received quantity on ${label}.`;
    }
  }

  return null;
}

export function isGrnExceptionInvalid(received: string, exceptionQty: string): boolean {
  const receivedNum = parseGrnQuantity(received);
  const exceptionNum = parseGrnQuantity(exceptionQty || "0");
  if (!Number.isFinite(receivedNum) || receivedNum <= 0) return false;
  if (!Number.isFinite(exceptionNum)) return true;
  return exceptionNum > receivedNum + 0.0001;
}

export function defaultGrnExceptionForReceived(received: string): {
  exception_quantity: string;
  quantity_accepted: string;
  quantity_rejected: string;
} {
  return {
    exception_quantity: "0",
    ...computeGrnLineQuantities(received, "0"),
  };
}

export function syncGrnQuantitiesOnReceivedChange(
  line: GrnQuantityLine,
  nextReceived: string
): Pick<GrnQuantityLine, "quantity_received" | "exception_quantity"> & {
  quantity_accepted: string;
  quantity_rejected: string;
} {
  const prevReceived = parseGrnQuantity(line.quantity_received);
  const prevException = parseGrnQuantity(line.exception_quantity || "0");

  const keepException =
    Number.isFinite(prevReceived) &&
    Number.isFinite(prevException) &&
    prevException <= prevReceived + 0.0001;

  const nextException = keepException ? String(prevException) : "0";
  return {
    quantity_received: nextReceived,
    exception_quantity: nextException,
    ...computeGrnLineQuantities(nextReceived, nextException),
  };
}

export function syncGrnQuantitiesOnExceptionChange(received: string, nextException: string) {
  return {
    exception_quantity: nextException,
    ...computeGrnLineQuantities(received, nextException),
  };
}

/** @deprecated Use validateGrnExceptionLines */
export function validateGrnAcceptRejectLines(
  lines: Array<{
    variant_sku?: string;
    quantity_received: string;
    quantity_accepted: string;
    quantity_rejected: string;
  }>
): string | null {
  return validateGrnExceptionLines(
    lines.map((line) => ({
      variant_sku: line.variant_sku,
      quantity_received: line.quantity_received,
      exception_quantity: line.quantity_rejected,
    }))
  );
}

/** @deprecated */
export function defaultGrnAcceptRejectForReceived(received: string) {
  const base = defaultGrnExceptionForReceived(received);
  return {
    quantity_accepted: base.quantity_accepted,
    quantity_rejected: base.quantity_rejected,
  };
}

/** @deprecated */
export function syncGrnAcceptRejectOnReceivedChange(
  line: {
    quantity_received: string;
    quantity_accepted: string;
    quantity_rejected: string;
  },
  nextReceived: string
) {
  const synced = syncGrnQuantitiesOnReceivedChange(
    {
      quantity_received: line.quantity_received,
      exception_quantity: line.quantity_rejected,
    },
    nextReceived
  );
  return {
    quantity_received: synced.quantity_received,
    quantity_accepted: synced.quantity_accepted,
    quantity_rejected: synced.quantity_rejected,
  };
}
