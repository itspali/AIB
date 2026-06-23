import { redirect } from "next/navigation";
import { itemPeekHref } from "@/lib/products/item-navigation";

export default async function ViewItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(itemPeekHref(id));
}
