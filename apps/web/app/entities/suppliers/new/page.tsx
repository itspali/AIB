import { redirect } from "next/navigation";

export default function NewEntitySupplierRedirect() {
  redirect("/procurement/suppliers/new");
}
