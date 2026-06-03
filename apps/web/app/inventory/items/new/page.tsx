import { redirect } from "next/navigation";
import { itemCreateHref } from "@/lib/products/item-navigation";

export default function NewItemPage() {
  redirect(itemCreateHref());
}
