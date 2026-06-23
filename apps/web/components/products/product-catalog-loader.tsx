import dynamic from "next/dynamic";
import { getModulePageContext } from "@/lib/layout/module-page";
import { resolveProductCatalogLoaderProps } from "@/lib/products/catalog-loader-props";
import { ProductCatalogPageSkeleton } from "@/components/products/product-catalog-page-skeleton";

const ProductCatalogTerminal = dynamic(
  () =>
    import("@/components/products/product-catalog-terminal").then(
      (module) => module.ProductCatalogTerminal
    ),
  { loading: () => <ProductCatalogPageSkeleton /> }
);

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export async function ProductCatalogLoader({ searchParams }: Props) {
  const { supabase, tenantId, userId, operatorRole } = await getModulePageContext();
  const props = await resolveProductCatalogLoaderProps({
    supabase,
    tenantId,
    userId,
    operatorRole,
    searchParams,
  });

  return <ProductCatalogTerminal {...props} />;
}
