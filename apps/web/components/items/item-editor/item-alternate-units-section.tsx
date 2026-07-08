"use client";

import type { FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { EditorField } from "@/components/products/product-editor/editor-form-primitives";
import { ProductUnitsSection } from "@/components/products/product-units-section";
import { Input } from "@/components/ui/input";
import { gtinFieldHint } from "@/lib/products/catalog-item-settings";
import { ITEM_EDITOR_FIELD_HELP } from "@/lib/products/item-editor-field-help";
import { editorEmptyStateClass } from "@/lib/products/editor-chrome";
import type {
  ProductCatalogContext,
  ProductMasterFormValues,
} from "@/lib/products/types";

type Props = {
  isPanelLayout: boolean;
  isMultiSku: boolean;
  isPhysical: boolean;
  catalogContext: ProductCatalogContext;
  baseUom: string;
  alternateUoms: ProductMasterFormValues["alternate_uoms"];
  fieldDisabled: boolean;
  register: UseFormRegister<ProductMasterFormValues>;
  errors: FieldErrors<ProductMasterFormValues>;
  setValue: UseFormSetValue<ProductMasterFormValues>;
  disableInput: (formField: keyof ProductMasterFormValues | string, lockKey?: string) => boolean;
};

export function ItemAlternateUnitsSection({
  isPanelLayout,
  isMultiSku,
  isPhysical,
  catalogContext,
  baseUom,
  alternateUoms,
  fieldDisabled,
  register,
  errors,
  setValue,
  disableInput,
}: Props) {
  return (
    <div className="space-y-4">
      {!isMultiSku && !isPhysical ? (
        <EditorField
          label="GTIN / Barcode"
          htmlFor="barcode"
          error={errors.barcode?.message}
          hint={gtinFieldHint(catalogContext.catalog_items.scan_identifier_policy)}
        >
          <Input
            id="barcode"
            disabled={disableInput("barcode")}
            className="font-mono"
            {...register("barcode")}
          />
        </EditorField>
      ) : isMultiSku ? (
        <p className={editorEmptyStateClass(isPanelLayout)}>
          {ITEM_EDITOR_FIELD_HELP.gtinMultiSku}
        </p>
      ) : null}

      <ProductUnitsSection
        catalogContext={catalogContext}
        baseUom={baseUom}
        alternateUoms={alternateUoms ?? []}
        alternatesDisabled={fieldDisabled}
        hideHeading
        onAlternateUomsChange={(rows) => setValue("alternate_uoms", rows, { shouldDirty: true })}
      />
    </div>
  );
}
