import { Suspense } from "react";
import { ProductCatalogLoader } from "@/components/products/product-catalog-loader";
import { ProductCatalogPageSkeleton } from "@/components/products/product-catalog-page-skeleton";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Row clicks use pushState (no RSC). Hard refresh / shared links pass `id` into the loader for drawer SSR. */
export default async function ItemsCatalogPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;

  return (
    <Suspense fallback={<ProductCatalogPageSkeleton />}>
      <ProductCatalogLoader searchParams={resolvedSearchParams} />
    </Suspense>
  );
}
