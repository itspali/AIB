import { redirect } from "next/navigation";
import { itemEditHref } from "@/lib/products/item-navigation";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(itemEditHref(id));
}
