import { redirect } from "next/navigation";
import { entityEditHref } from "@/lib/entities/entity-navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EntitySupplierEditPage({ params }: Props) {
  const { id } = await params;
  redirect(entityEditHref("supplier", id));
}
