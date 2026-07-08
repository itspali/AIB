"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { EditorField } from "@/components/products/product-editor/editor-form-primitives";
import { Input } from "@/components/ui/input";
import { ITEM_EDITOR_FIELD_HELP } from "@/lib/products/item-editor-field-help";
import { ITEM_LOGISTICS_MULTI_SKU_DESCRIPTION } from "@/lib/products/product-user-labels";
import { formatCalculatedVolumeInfo } from "@/lib/products/shipping-dimensions";
import type { ProductMasterFormValues } from "@/lib/products/types";
import {
  editorFieldSpanFullClass,
  editorShippingDimensionsGridClass,
} from "@/lib/products/editor-chrome";
import { cn } from "@/lib/utils";

type Props = {
  isPanelLayout: boolean;
  isMultiSku?: boolean;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  register: UseFormRegister<ProductMasterFormValues>;
  errors: FieldErrors<ProductMasterFormValues>;
  disableInput: (formField: keyof ProductMasterFormValues | string, lockKey?: string) => boolean;
};

export function ItemDimensionsSection({
  isPanelLayout,
  isMultiSku = false,
  lengthCm,
  widthCm,
  heightCm,
  register,
  errors,
  disableInput,
}: Props) {
  return (
    <div className="space-y-3">
      {isMultiSku ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {ITEM_LOGISTICS_MULTI_SKU_DESCRIPTION}
        </p>
      ) : null}
      <div
        className={cn(
          editorFieldSpanFullClass(isPanelLayout),
          editorShippingDimensionsGridClass(isPanelLayout)
        )}
      >
        <EditorField
          label="Length (cm)"
          htmlFor="length_cm"
          error={errors.length_cm?.message}
          hint={ITEM_EDITOR_FIELD_HELP.lengthCm}
        >
          <Input
            id="length_cm"
            disabled={disableInput("length_cm")}
            className="text-right font-mono"
            inputMode="decimal"
            {...register("length_cm")}
          />
        </EditorField>
        <EditorField
          label="Width (cm)"
          htmlFor="width_cm"
          error={errors.width_cm?.message}
          hint={ITEM_EDITOR_FIELD_HELP.widthCm}
        >
          <Input
            id="width_cm"
            disabled={disableInput("width_cm")}
            className="text-right font-mono"
            inputMode="decimal"
            {...register("width_cm")}
          />
        </EditorField>
        <EditorField
          label="Height (cm)"
          htmlFor="height_cm"
          error={errors.height_cm?.message}
          hint={ITEM_EDITOR_FIELD_HELP.heightCm}
        >
          <Input
            id="height_cm"
            disabled={disableInput("height_cm")}
            className="text-right font-mono"
            inputMode="decimal"
            {...register("height_cm")}
          />
        </EditorField>
        <EditorField
          label="Weight (kg)"
          htmlFor="dead_weight_kg"
          error={errors.dead_weight_kg?.message}
          hint={ITEM_EDITOR_FIELD_HELP.weightShipping}
        >
          <Input
            id="dead_weight_kg"
            disabled={disableInput("dead_weight_kg")}
            className="text-right font-mono"
            inputMode="decimal"
            {...register("dead_weight_kg")}
          />
        </EditorField>
      </div>
      <p
        className={cn(
          "text-xs leading-relaxed text-muted-foreground",
          editorFieldSpanFullClass(isPanelLayout),
          isPanelLayout ? "pt-0.5" : "pt-1"
        )}
      >
        {formatCalculatedVolumeInfo(lengthCm, widthCm, heightCm)}
      </p>
    </div>
  );
}
