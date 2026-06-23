import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EntitySupplierEditRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/procurement/suppliers/${id}/edit`);
}
