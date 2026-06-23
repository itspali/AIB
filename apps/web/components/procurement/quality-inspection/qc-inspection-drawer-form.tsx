"use client";

import { useEffect, useState } from "react";
import {
  loadQcInspectionQueueRow,
  loadQcTestTemplateForItem,
} from "@/app/(workspace)/procurement/quality-inspection/actions";
import { QcLineInspectionForm } from "@/components/procurement/quality-inspection/qc-line-inspection-form";
import { RightDrawer } from "@/components/ui/right-drawer";
import { Spinner } from "@/components/ui/spinner";
import { PROCUREMENT_GRN_HREF } from "@/lib/procurement/navigation";
import type {
  QcInspectionQueueRow,
  QcTestTemplate,
} from "@/lib/procurement/quality-inspection/types";
import Link from "next/link";

type Props = {
  open: boolean;
  goodsReceiptItemId: string | null;
  peekRow: QcInspectionQueueRow | null;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void | Promise<void>;
};

export function QcInspectionDrawerForm({
  open,
  goodsReceiptItemId,
  peekRow,
  onOpenChange,
  onCompleted,
}: Props) {
  const [row, setRow] = useState<QcInspectionQueueRow | null>(peekRow);
  const [template, setTemplate] = useState<QcTestTemplate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !goodsReceiptItemId) {
      setRow(peekRow);
      setTemplate(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setRow(peekRow);
    setLoading(true);

    void (async () => {
      const detailResult = peekRow
        ? { row: peekRow }
        : await loadQcInspectionQueueRow(goodsReceiptItemId);

      if (cancelled) return;

      if ("error" in detailResult) {
        setLoading(false);
        return;
      }

      const resolvedRow = detailResult.row;
      setRow(resolvedRow);

      const templateResult = await loadQcTestTemplateForItem(resolvedRow.item_id);
      if (cancelled) return;

      setTemplate(templateResult.template);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [goodsReceiptItemId, open, peekRow]);

  if (!open) return null;

  return (
    <RightDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={row ? `Inspect ${row.variant_sku}` : "Quality inspection"}
      preferredWidthVw={60}
      allowBackgroundInteraction
      bodyClassName="module-drawer-form-body"
      showCloseButton
    >
      {loading || !row ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" />
          Loading inspection…
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Open parent receipt:{" "}
            <Link
              href={`${PROCUREMENT_GRN_HREF}?id=${encodeURIComponent(row.goods_receipt_id)}`}
              className="font-mono text-primary underline-offset-2 hover:underline"
            >
              {row.grn_number}
            </Link>
          </p>
          <QcLineInspectionForm
            row={row}
            template={template}
            onCompleted={async () => {
              await onCompleted();
              onOpenChange(false);
            }}
          />
        </div>
      )}
    </RightDrawer>
  );
}
