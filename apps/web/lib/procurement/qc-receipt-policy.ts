export const QC_RECEIPT_POLICIES = ["INHERIT", "REQUIRED", "EXEMPT"] as const;

export type QcReceiptPolicy = (typeof QC_RECEIPT_POLICIES)[number];

export function isQcReceiptPolicy(value: string): value is QcReceiptPolicy {
  return (QC_RECEIPT_POLICIES as readonly string[]).includes(value);
}

export function qcReceiptPolicyLabel(policy: QcReceiptPolicy): string {
  switch (policy) {
    case "INHERIT":
      return "Inherit";
    case "REQUIRED":
      return "QC required";
    case "EXEMPT":
      return "QC exempt";
  }
}

export type QcPolicyContext = {
  qcModuleEnabled: boolean;
  allowLineOverride: boolean;
  orgDefaultRouteToQc: boolean;
};

export type VariantQcPolicyHint = {
  variant_id: string;
  item_id: string;
  item_policy: QcReceiptPolicy;
  category_policy: QcReceiptPolicy | null;
};

type CategoryPolicyNode = {
  id: string;
  parent_id: string | null;
  qc_receipt_policy: QcReceiptPolicy;
};

export function effectiveCategoryQcPolicy(
  categoryId: string,
  categories: Map<string, CategoryPolicyNode>,
  directPolicy: QcReceiptPolicy | null
): QcReceiptPolicy | null {
  let currentId: string | null = categoryId;
  while (currentId) {
    const node = categories.get(currentId);
    if (!node) break;
    if (node.qc_receipt_policy !== "INHERIT") {
      return node.qc_receipt_policy;
    }
    currentId = node.parent_id;
  }
  return directPolicy;
}

/** Client-side default route before optional line override. */
export function resolveDefaultRouteToQc(
  context: QcPolicyContext,
  hint: Pick<VariantQcPolicyHint, "item_policy" | "category_policy">
): boolean {
  if (!context.qcModuleEnabled) return false;

  if (hint.item_policy === "EXEMPT") return false;
  if (hint.item_policy === "REQUIRED") return true;

  if (hint.category_policy === "EXEMPT") return false;
  if (hint.category_policy === "REQUIRED") return true;

  return context.orgDefaultRouteToQc;
}

export function resolveLineRouteToQc(
  context: QcPolicyContext,
  hint: Pick<VariantQcPolicyHint, "item_policy" | "category_policy">,
  lineOverride: boolean | undefined
): boolean {
  const defaultRoute = resolveDefaultRouteToQc(context, hint);
  if (!context.allowLineOverride || lineOverride === undefined) {
    return defaultRoute;
  }
  return lineOverride;
}

export function computeGrnAcceptedQuantity(received: string, exceptionQty: string): string {
  const receivedNum = Number(received);
  const exceptionNum = Number(exceptionQty || "0");
  if (!Number.isFinite(receivedNum) || !Number.isFinite(exceptionNum)) return "";
  const accepted = Math.max(receivedNum - exceptionNum, 0);
  if (Number.isInteger(accepted)) return String(accepted);
  return accepted.toFixed(4).replace(/\.?0+$/, "");
}

export function grnStockColumnLabel(qcModuleEnabled: boolean): string {
  return qcModuleEnabled ? "Into QC hold" : "Into stock";
}
