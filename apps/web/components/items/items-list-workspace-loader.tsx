import dynamic from "next/dynamic";
import { getModulePageContext } from "@/lib/layout/module-page";
import { resolveProductCatalogLoaderProps } from "@/lib/products/catalog-loader-props";
import { ItemsListPageSkeleton } from "@/components/items/items-list-page-skeleton";

const ItemsListWorkspaceTerminal = dynamic(
  () =>
    import("@/components/items/items-list-workspace-terminal").then(
      (module) => module.ItemsListWorkspaceTerminal
    ),
  { loading: () => <ItemsListPageSkeleton /> }
);

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export async function ItemsListWorkspaceLoader({ searchParams }: Props) {
  const { supabase, tenantId, userId, operatorRole } = await getModulePageContext();
  const props = await resolveProductCatalogLoaderProps({
    supabase,
    tenantId,
    userId,
    operatorRole,
    searchParams,
  });

  return <ItemsListWorkspaceTerminal {...props} />;
}
