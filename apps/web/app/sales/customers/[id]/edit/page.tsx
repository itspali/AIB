import { redirect } from "next/navigation";
import { entityEditHref } from "@/lib/entities/entity-navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SalesCustomerEditPage({ params }: Props) {
  const { id } = await params;
  redirect(entityEditHref("customer", id));
}
