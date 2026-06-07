import { taxRuleBasisLabel, type TaxRuleBasis } from "@/lib/tax/types";

type PreviewRule = {
  basis: TaxRuleBasis;
  threshold_min: number;
  threshold_max: number | null;
  rate: number;
};

type Props = {
  isVariable: boolean;
  rate: number;
  rules: PreviewRule[];
};

function formatBound(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function TaxRulePreview({ isVariable, rate, rules }: Props) {
  if (!isVariable) {
    return (
      <div className="rounded-lg border border-border/80 border-black/[0.06] bg-muted/35 px-4 py-3 text-sm dark:border-white/10 dark:bg-muted/20">
        <p className="text-muted-foreground">
          Flat rate: <span className="font-medium text-foreground">{rate}%</span> on every line.
        </p>
      </div>
    );
  }

  const sorted = [...rules].sort((a, b) => a.threshold_min - b.threshold_min);

  return (
    <div className="space-y-2 rounded-lg border border-border/80 border-black/[0.06] bg-muted/35 px-4 py-3 text-sm dark:border-white/10 dark:bg-muted/20">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Resolves by {sorted.length ? taxRuleBasisLabel(sorted[0].basis).toLowerCase() : "value"}
      </p>
      {sorted.length === 0 ? (
        <p className="text-muted-foreground">Add slab tiers to preview the resolved rates.</p>
      ) : (
        <ul className="space-y-1">
          {sorted.map((rule, index) => (
            <li key={index} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                {rule.threshold_max === null
                  ? `${formatBound(rule.threshold_min)} and above`
                  : `${formatBound(rule.threshold_min)} – ${formatBound(rule.threshold_max)}`}
              </span>
              <span className="font-medium tabular-nums">{rule.rate}%</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Final rate is determined per sales line from the value (after discount).
      </p>
    </div>
  );
}
