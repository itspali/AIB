import { redirect } from "next/navigation";
import { entityCreateHref } from "@/lib/entities/entity-navigation";

export default function NewSalesCustomerPage() {
  redirect(entityCreateHref("customer"));
}
