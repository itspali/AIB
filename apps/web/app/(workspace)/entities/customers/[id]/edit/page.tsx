import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EntityCustomerEditRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/sales/customers/${id}/edit`);
}
