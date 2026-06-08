"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { EntityCustomFieldsBuilder } from "@/components/settings/entity-custom-fields-builder";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type EntityCustomFieldDefinition,
  type EntitySettingsMetadata,
} from "@/lib/entities/custom-field-definitions";
import type { EntityWorkspace } from "@/lib/entities/types";

type Props = {
  title: string;
  description: string;
  entitySettings: EntitySettingsMetadata;
  inheritedGroupSettings?: EntitySettingsMetadata | null;
  disabled?: boolean;
  onSave: (
    workspace: EntityWorkspace,
    definitions: EntityCustomFieldDefinition[]
  ) => Promise<{ error?: string; success?: true }>;
};

function definitionsForWorkspace(
  settings: EntitySettingsMetadata | null | undefined,
  workspace: EntityWorkspace
): EntityCustomFieldDefinition[] {
  return workspace === "customer"
    ? (settings?.customer?.custom_field_definitions ?? [])
    : (settings?.supplier?.custom_field_definitions ?? []);
}

export function EntityCustomFieldsSettingsPanel({
  title,
  description,
  entitySettings,
  inheritedGroupSettings = null,
  disabled = false,
  onSave,
}: Props) {
  const [activeWorkspace, setActiveWorkspace] = useState<EntityWorkspace>("customer");
  const [customerDraft, setCustomerDraft] = useState<EntityCustomFieldDefinition[]>(
    definitionsForWorkspace(entitySettings, "customer")
  );
  const [supplierDraft, setSupplierDraft] = useState<EntityCustomFieldDefinition[]>(
    definitionsForWorkspace(entitySettings, "supplier")
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCustomerDraft(definitionsForWorkspace(entitySettings, "customer"));
    setSupplierDraft(definitionsForWorkspace(entitySettings, "supplier"));
  }, [entitySettings]);

  const handleSave = () => {
    const definitions =
      activeWorkspace === "customer" ? customerDraft : supplierDraft;

    startTransition(async () => {
      const result = await onSave(activeWorkspace, definitions);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${activeWorkspace === "customer" ? "Customer" : "Supplier"} custom fields saved`
      );
    });
  };

  return (
    <OrgSettingsSection title={title} description={description}>
      <Tabs
        value={activeWorkspace}
        onValueChange={(value) => setActiveWorkspace(value as EntityWorkspace)}
      >
        <TabsList>
          <TabsTrigger value="customer">Customers</TabsTrigger>
          <TabsTrigger value="supplier">Suppliers</TabsTrigger>
        </TabsList>
        <TabsContent value="customer" className="mt-4 space-y-4">
          {inheritedGroupSettings ? (
            <p className="text-xs text-muted-foreground">
              Group-defined customer fields are inherited automatically. Organization fields below
              extend or override group keys with the same slug.
            </p>
          ) : null}
          <EntityCustomFieldsBuilder
            rows={customerDraft}
            onChange={setCustomerDraft}
            disabled={disabled || isPending}
          />
        </TabsContent>
        <TabsContent value="supplier" className="mt-4 space-y-4">
          {inheritedGroupSettings ? (
            <p className="text-xs text-muted-foreground">
              Group-defined supplier fields are inherited automatically. Organization fields below
              extend or override group keys with the same slug.
            </p>
          ) : null}
          <EntityCustomFieldsBuilder
            rows={supplierDraft}
            onChange={setSupplierDraft}
            disabled={disabled || isPending}
          />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button type="button" disabled={disabled || isPending} onClick={handleSave}>
          Save {activeWorkspace === "customer" ? "customer" : "supplier"} fields
        </Button>
      </div>
    </OrgSettingsSection>
  );
}
