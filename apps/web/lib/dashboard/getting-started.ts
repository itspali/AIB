import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type GettingStartedTaskId =
  | "first_product"
  | "categories"
  | "first_customer"
  | "first_supplier"
  | "org_settings"
  | "locations";

export type GettingStartedTask = {
  id: GettingStartedTaskId;
  title: string;
  description: string;
  href: string;
  completed: boolean;
};

export type GettingStartedSnapshot = {
  tasks: GettingStartedTask[];
  completedCount: number;
  totalCount: number;
  dismissed: boolean;
  visible: boolean;
};

async function countForTenant(
  supabase: SupabaseClient,
  table: string,
  tenantId: string
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (error) return 0;
  return count ?? 0;
}

async function countEntitiesForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  types: ("CUSTOMER" | "SUPPLIER" | "MUTUAL_PARTNER")[]
): Promise<number> {
  const { count, error } = await supabase
    .from("entities")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .in("type", types);

  if (error) return 0;
  return count ?? 0;
}

export async function fetchGettingStartedSnapshot(
  supabase: SupabaseClient,
  tenantId: string
): Promise<GettingStartedSnapshot> {
  const [{ data: tenant }, itemCount, categoryCount, locationCount, customerCount, supplierCount] =
    await Promise.all([
      supabase.from("tenants").select("metadata_json, onboarding_status").eq("id", tenantId).single(),
      countForTenant(supabase, "items", tenantId),
      countForTenant(supabase, "item_categories", tenantId),
      countForTenant(supabase, "tenant_locations", tenantId),
      countEntitiesForTenant(supabase, tenantId, ["CUSTOMER", "MUTUAL_PARTNER"]),
      countEntitiesForTenant(supabase, tenantId, ["SUPPLIER", "MUTUAL_PARTNER"]),
    ]);

  const metadata = (tenant?.metadata_json as Record<string, unknown> | null) ?? {};
  const dismissed = metadata.getting_started_dismissed === true;
  const orgSettingsReviewed = metadata.getting_started_org_reviewed === true;

  const tasks: GettingStartedTask[] = [
    {
      id: "first_product",
      title: "Add your first product",
      description: "Create a catalog item to start inventory and sales workflows.",
      href: "/items?action=new",
      completed: itemCount >= 1,
    },
    {
      id: "categories",
      title: "Set up product categories",
      description: "Group items for reporting, pricing, and storefront merchandising.",
      href: "/items/categories",
      completed: categoryCount >= 1,
    },
    {
      id: "first_supplier",
      title: "Add your first supplier",
      description: "Create a supplier profile for purchase orders and goods receipts.",
      href: "/entities/suppliers?action=new",
      completed: supplierCount >= 1,
    },
    {
      id: "first_customer",
      title: "Add your first customer",
      description: "Create a customer account for sales orders and invoicing.",
      href: "/entities/customers?action=new",
      completed: customerCount >= 1,
    },
    {
      id: "org_settings",
      title: "Review organization settings",
      description: "Confirm billing identity, fiscal profile, and governance defaults.",
      href: "/settings/organization",
      completed: orgSettingsReviewed,
    },
    {
      id: "locations",
      title: "Configure warehouse locations",
      description: "Add or refine stock-holding sites beyond your onboarding home location.",
      href: "/settings/locations",
      completed: locationCount >= 2,
    },
  ];

  const completedCount = tasks.filter((task) => task.completed).length;
  const isLive = tenant?.onboarding_status === "GO_LIVE_READY";

  return {
    tasks,
    completedCount,
    totalCount: tasks.length,
    dismissed,
    visible: isLive && !dismissed,
  };
}
