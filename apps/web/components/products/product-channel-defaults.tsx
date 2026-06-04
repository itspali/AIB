"use client";

import { fieldHelpText, SubsectionHeading } from "@/components/ui/field-label-info";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { editorSwitchSize } from "@/lib/products/editor-chrome";
import type { ProductCatalogContext, ProductMasterFormValues } from "@/lib/products/types";

type Props = {
  storefronts: ProductCatalogContext["storefronts"];
  values: ProductMasterFormValues["storefront_visibility"];
  disabled?: boolean;
  compact?: boolean;
  onChange: (values: ProductMasterFormValues["storefront_visibility"]) => void;
};

/** Product-level channel visibility — applies to all variants unless overridden in Advanced. */
export function ProductChannelDefaults({
  storefronts,
  values,
  disabled,
  compact,
  onChange,
}: Props) {
  if (storefronts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active storefront channels. Complete channel setup in onboarding or settings.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      <SubsectionHeading
        title="Channels"
        compact={compact}
        info={fieldHelpText("Product-level visibility; per-SKU overrides are under Advanced.")}
      />
      <ul className="divide-y divide-border/50 border-t border-border/50 pt-2">
        {values.map((row, index) => {
          const channel = storefronts.find((entry) => entry.id === row.storefront_id);
          if (!channel) return null;
          return (
            <li
              key={row.storefront_id}
              className="flex items-center justify-between gap-3 py-2 first:pt-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{channel.name}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Label className="text-xs text-muted-foreground">Visible</Label>
                <Switch
                  size={editorSwitchSize}
                  checked={row.is_visible}
                  disabled={disabled}
                  onCheckedChange={(checked) => {
                    const next = [...values];
                    next[index] = { ...next[index], is_visible: checked };
                    onChange(next);
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
