"use client";

type Props = {
  isBundle: boolean;
  itemId: string | null;
};

export function ItemCompositeSection({ isBundle, itemId }: Props) {
  if (!isBundle || !itemId) return null;
  return (
    <p className="text-sm text-muted-foreground">Add components in the Composition step.</p>
  );
}
