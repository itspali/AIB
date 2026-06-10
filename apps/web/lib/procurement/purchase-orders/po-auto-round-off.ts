export type PoAutoRoundOffPolicy = {
  enabled: boolean;
  step: number;
};

export const PO_AUTO_ROUND_OFF_STEP_PRESETS = [0.01, 0.05, 0.1, 1] as const;

export type PoAutoRoundOffStepPreset = (typeof PO_AUTO_ROUND_OFF_STEP_PRESETS)[number];

export function resolvePoAutoRoundOffStep(value: unknown): PoAutoRoundOffStepPreset {
  const parsed = typeof value === "number" ? value : Number(value);
  if (PO_AUTO_ROUND_OFF_STEP_PRESETS.includes(parsed as PoAutoRoundOffStepPreset)) {
    return parsed as PoAutoRoundOffStepPreset;
  }
  return 1;
}

export function computePoAutoRoundOff(
  preRoundTotal: number,
  step: number
): { roundOffAmount: number; grandTotal: number } {
  if (!Number.isFinite(preRoundTotal) || step <= 0) {
    return { roundOffAmount: 0, grandTotal: preRoundTotal };
  }

  const quotient = preRoundTotal / step;
  const roundedQuotient = Math.round(quotient);
  const grandTotal = Number((roundedQuotient * step).toFixed(10));
  const roundOffAmount = Number((grandTotal - preRoundTotal).toFixed(10));

  return { roundOffAmount, grandTotal };
}

export function resolvePoAutoRoundOffPolicy(settings: {
  po_auto_round_off_enabled?: boolean;
  po_auto_round_off_step?: unknown;
}): PoAutoRoundOffPolicy {
  return {
    enabled: settings.po_auto_round_off_enabled === true,
    step: resolvePoAutoRoundOffStep(settings.po_auto_round_off_step),
  };
}
