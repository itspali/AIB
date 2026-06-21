import type { EntityWorkspace } from "@/lib/entities/types";
import {
  moduleDrawerCreateHref,
  moduleDrawerEditHref,
  moduleDrawerPeekHref,
} from "@/lib/layout/module-drawer-url";

export const ENTITIES_HREF = "/sales";
export const CUSTOMERS_HREF = "/sales/customers";
export const SUPPLIERS_HREF = "/procurement/suppliers";

export function entityListHref(workspace: EntityWorkspace): string {
  return workspace === "customer" ? CUSTOMERS_HREF : SUPPLIERS_HREF;
}

export function entityCreateHref(workspace: EntityWorkspace): string {
  return moduleDrawerCreateHref(entityListHref(workspace));
}

export function entityPeekHref(workspace: EntityWorkspace, entityId: string): string {
  return moduleDrawerPeekHref(entityListHref(workspace), entityId);
}

export function entityEditHref(workspace: EntityWorkspace, entityId: string): string {
  return moduleDrawerEditHref(entityListHref(workspace), entityId);
}
