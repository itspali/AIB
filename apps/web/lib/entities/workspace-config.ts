import { CUSTOMERS_HREF, SUPPLIERS_HREF } from "@/lib/entities/entity-navigation";
import type {
  EntityCommercialType,
  EntityWorkspace,
  EntityWorkspaceConfig,
} from "@/lib/entities/types";

const CUSTOMER_TYPE_FILTER: readonly EntityCommercialType[] = [
  "CUSTOMER",
  "MUTUAL_PARTNER",
];

const SUPPLIER_TYPE_FILTER: readonly EntityCommercialType[] = [
  "SUPPLIER",
  "MUTUAL_PARTNER",
];

const WORKSPACE_CONFIG: Record<EntityWorkspace, EntityWorkspaceConfig> = {
  customer: {
    workspace: "customer",
    title: "Customers",
    description: "Manage customer profiles, credit limits, and primary contacts.",
    listHref: CUSTOMERS_HREF,
    defaultType: "CUSTOMER",
    typeFilter: CUSTOMER_TYPE_FILTER,
    savedViewModuleKey: "entity-customers",
    listColumnRegistryKey: "customer",
    createLabel: "New customer",
    singularLabel: "Customer",
    emptyStateTitle: "No customers yet",
    emptyStateDescription:
      "Add your first customer to track credit limits, payment terms, and contacts.",
  },
  supplier: {
    workspace: "supplier",
    title: "Suppliers",
    description: "Manage supplier profiles, payment terms, and primary contacts.",
    listHref: SUPPLIERS_HREF,
    defaultType: "SUPPLIER",
    typeFilter: SUPPLIER_TYPE_FILTER,
    savedViewModuleKey: "entity-suppliers",
    listColumnRegistryKey: "supplier",
    createLabel: "New supplier",
    singularLabel: "Supplier",
    emptyStateTitle: "No suppliers yet",
    emptyStateDescription:
      "Add your first supplier to use them on purchase orders and goods receipts.",
  },
};

export function getEntityWorkspaceConfig(workspace: EntityWorkspace): EntityWorkspaceConfig {
  return WORKSPACE_CONFIG[workspace];
}

export function entityWorkspaceFromType(type: EntityCommercialType): EntityWorkspace | null {
  if (type === "CUSTOMER") return "customer";
  if (type === "SUPPLIER") return "supplier";
  return null;
}
