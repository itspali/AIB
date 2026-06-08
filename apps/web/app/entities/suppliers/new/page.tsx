import { redirect } from "next/navigation";
import { entityCreateHref } from "@/lib/entities/entity-navigation";

export default function NewEntitySupplierPage() {
  redirect(entityCreateHref("supplier"));
}
