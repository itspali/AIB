"use client";

import { useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { saveProductMasterProfile } from "@/app/items/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parentSelectOptions } from "@/lib/categories/tree";
import type { CategoryRow } from "@/lib/categories/types";
import {
  ITEM_CLASSIFICATIONS,
  classificationLabel,
} from "@/lib/products/classification-labels";
import { productMasterSchema } from "@/lib/products/schemas";
import { UOM_OPTIONS } from "@/lib/products/uom-options";
import {
  defaultProductFormValues,
  type ProductMasterFormValues,
} from "@/lib/products/types";

type Props = {
  categories: CategoryRow[];
  initialValues?: ProductMasterFormValues;
  onCancel: () => void;
  onSaved: (itemId: string) => void;
};

export function ProductMasterForm({ categories, initialValues, onCancel, onSaved }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<ProductMasterFormValues>({
    resolver: zodResolver(productMasterSchema),
    defaultValues: initialValues ?? defaultProductFormValues,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const showAdvanced = watch("show_advanced");
  const categoryOptions = parentSelectOptions(categories).filter((option) => option.id !== null);

  const onSubmit = useCallback(
    (values: ProductMasterFormValues) => {
      startTransition(async () => {
        const result = await saveProductMasterProfile(values);

        if ("error" in result) {
          toast.error(result.error ?? "Unable to save product profile.");
          return;
        }

        toast.success("Product master profile saved successfully");
        onSaved(result.itemId);
        router.refresh();
      });
    },
    [onSaved, router]
  );

  useEffect(() => {
    form.reset(initialValues ?? defaultProductFormValues);
  }, [initialValues, form]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void handleSubmit(onSubmit)();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSubmit, onSubmit]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-24">
      <div>
        <h2 className="text-xl font-semibold">
          {initialValues?.item_id ? "Edit Product Master Profile" : "Create Product Master Profile"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Essentials are always visible. Advanced logistical and statutory fields stay hidden until
          enabled.
        </p>
      </div>

      <section className="surface-panel space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Essential Product Attributes
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Product classification type
            </Label>
            <Select
              value={watch("classification")}
              disabled={isPending}
              onValueChange={(value) =>
                setValue("classification", value as ProductMasterFormValues["classification"], {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select classification" />
              </SelectTrigger>
              <SelectContent>
                {ITEM_CLASSIFICATIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {classificationLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.classification && (
              <p className="text-xs text-destructive">{errors.classification.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-muted-foreground">
              Root product name
            </Label>
            <Input id="name" disabled={isPending} {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sku" className="text-sm font-medium text-muted-foreground">
              Master variant SKU
            </Label>
            <Input id="sku" disabled={isPending} className="font-mono" {...register("sku")} />
            {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Base unit of measure
            </Label>
            <Select
              value={watch("base_unit_of_measure")}
              disabled={isPending}
              onValueChange={(value) =>
                setValue("base_unit_of_measure", value, { shouldDirty: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UOM_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.base_unit_of_measure && (
              <p className="text-xs text-destructive">{errors.base_unit_of_measure.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Associated category node
            </Label>
            <Select
              value={watch("category_id") ?? "none"}
              disabled={isPending}
              onValueChange={(value) =>
                setValue("category_id", value === "none" ? null : value, { shouldDirty: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.id!} value={option.id!}>
                    {"— ".repeat(option.depth)}
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
        <div>
          <p className="text-sm font-medium">Show Advanced Parameters</p>
          <p className="text-xs text-muted-foreground">
            Reveal statutory codes, return policy, and dimensional bounds.
          </p>
        </div>
        <Switch
          checked={showAdvanced}
          disabled={isPending}
          onCheckedChange={(checked) => setValue("show_advanced", checked)}
        />
      </div>

      {showAdvanced && (
        <section className="surface-panel space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Advanced Logistical &amp; Statutory Attributes
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="hsn_sac_code" className="text-sm font-medium text-muted-foreground">
                Statutory return code (HSN/SAC)
              </Label>
              <Input
                id="hsn_sac_code"
                disabled={isPending}
                className="text-right font-mono"
                placeholder="e.g. 84713010"
                {...register("hsn_sac_code")}
              />
              {errors.hsn_sac_code && (
                <p className="text-xs text-destructive">{errors.hsn_sac_code.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Return policy eligibility</p>
                <p className="text-xs text-muted-foreground">
                  Allow this product to participate in return workflows.
                </p>
              </div>
              <Switch
                checked={watch("is_returnable")}
                disabled={isPending}
                onCheckedChange={(checked) => setValue("is_returnable", checked, { shouldDirty: true })}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="dead_weight_kg" className="text-sm font-medium text-muted-foreground">
                Variant physical dead weight (kg)
              </Label>
              <Input
                id="dead_weight_kg"
                disabled={isPending}
                className="text-right font-mono"
                inputMode="decimal"
                {...register("dead_weight_kg")}
              />
              {errors.dead_weight_kg && (
                <p className="text-xs text-destructive">{errors.dead_weight_kg.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="length_cm" className="text-sm font-medium text-muted-foreground">
                Length (cm)
              </Label>
              <Input
                id="length_cm"
                disabled={isPending}
                className="text-right font-mono"
                inputMode="decimal"
                {...register("length_cm")}
              />
              {errors.length_cm && (
                <p className="text-xs text-destructive">{errors.length_cm.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="width_cm" className="text-sm font-medium text-muted-foreground">
                Width (cm)
              </Label>
              <Input
                id="width_cm"
                disabled={isPending}
                className="text-right font-mono"
                inputMode="decimal"
                {...register("width_cm")}
              />
              {errors.width_cm && (
                <p className="text-xs text-destructive">{errors.width_cm.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="height_cm" className="text-sm font-medium text-muted-foreground">
                Height (cm)
              </Label>
              <Input
                id="height_cm"
                disabled={isPending}
                className="text-right font-mono"
                inputMode="decimal"
                {...register("height_cm")}
              />
              {errors.height_cm && (
                <p className="text-xs text-destructive">{errors.height_cm.message}</p>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="sticky bottom-0 mt-8 flex justify-end gap-2 border-t border-border bg-background/95 py-4 backdrop-blur">
        <Button type="button" variant="ghost" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} title="Save (Cmd/Ctrl + Enter)">
          Save Product Master Profile
        </Button>
      </div>
    </form>
  );
}
