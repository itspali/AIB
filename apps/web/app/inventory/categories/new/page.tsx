import { redirect } from "next/navigation";
import { categoryNewHref } from "@/lib/categories/category-navigation";

export default function NewCategoryPage() {
  redirect(categoryNewHref());
}
