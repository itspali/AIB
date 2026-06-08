import { redirect } from "next/navigation";
import { entityPeekHref } from "@/lib/entities/entity-navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EntityCustomerPeekPage({ params }: Props) {
  const { id } = await params;
  redirect(entityPeekHref("customer", id));
}
