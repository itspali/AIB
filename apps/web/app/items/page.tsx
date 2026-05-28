import { redirect } from "next/navigation";

export default function ItemsIndexPage() {
  redirect("/items/categories");
}
