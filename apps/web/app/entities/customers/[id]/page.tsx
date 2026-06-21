import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EntityCustomerPeekRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/sales/customers/${id}`);
}
