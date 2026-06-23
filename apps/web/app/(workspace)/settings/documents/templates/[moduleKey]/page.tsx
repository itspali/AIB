import { notFound, redirect } from "next/navigation";
import type { DocumentModuleKey } from "@/lib/documents/types";

const MODULE_KEYS = new Set<DocumentModuleKey>([
  "PURCHASE_ORDER",
  "GOODS_RECEIPT_NOTE",
  "PURCHASE_INVOICE",
  "SALES_QUOTATION",
  "SALES_ORDER",
  "SALES_INVOICE",
]);

type PageProps = {
  params: Promise<{ moduleKey: string }>;
};

export default async function DocumentModuleTemplatePage({ params }: PageProps) {
  const { moduleKey: rawModuleKey } = await params;
  if (!MODULE_KEYS.has(rawModuleKey as DocumentModuleKey)) {
    notFound();
  }

  redirect(`/settings/documents/templates?module=${encodeURIComponent(rawModuleKey)}`);
}
