import { redirect } from "next/navigation";

export default function NewEntityCustomerRedirect() {
  redirect("/sales/customers/new");
}
