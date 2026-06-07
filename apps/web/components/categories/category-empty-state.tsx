import Link from "next/link";
import { FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onCreate?: () => void;
  createHref?: string;
  hasExistingCategories?: boolean;
};

export function CategoryEmptyState({
  onCreate,
  createHref,
  hasExistingCategories = false,
}: Props) {
  const label = hasExistingCategories ? "Create Product Category" : "Create Initial Product Category";

  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 border-black/[0.06] bg-muted/35 px-6 py-12 text-center dark:border-white/10 dark:bg-muted/20">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
        <FolderTree className="h-8 w-8 text-primary" aria-hidden />
      </div>
      <p className="max-w-md text-sm font-medium">
        Select a category node from the folder tree to review structural attributes and dynamic
        templates.
      </p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Start by defining your first product category node to unblock catalog onboarding.
      </p>
      {createHref ? (
        <Button asChild className="mt-6 shadow-glow-sm">
          <Link href={createHref} prefetch>
            {label}
          </Link>
        </Button>
      ) : (
        <Button className="mt-6 shadow-glow-sm" onClick={onCreate}>
          {label}
        </Button>
      )}
    </div>
  );
}
