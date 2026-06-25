import { Suspense } from "react";
import { ItemsListWorkspaceLoader } from "@/components/items/items-list-workspace-loader";
import { ItemsListPageSkeleton } from "@/components/items/items-list-page-skeleton";
import { ListWorkspaceProvider } from "@/lib/layout/list-workspace";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ItemsCatalogPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;

  return (
    <ListWorkspaceProvider moduleId="items">
      <Suspense fallback={<ItemsListPageSkeleton />}>
        <ItemsListWorkspaceLoader searchParams={resolvedSearchParams} />
      </Suspense>
    </ListWorkspaceProvider>
  );
}
