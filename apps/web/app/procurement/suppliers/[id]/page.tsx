import { redirect } from "next/navigation";
import { entityPeekHref } from "@/lib/entities/entity-navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProcurementSupplierPeekPage({ params }: Props) {
  const { id } = await params;
  redirect(entityPeekHref("supplier", id));
}
