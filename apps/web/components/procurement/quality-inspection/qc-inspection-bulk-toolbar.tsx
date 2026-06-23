"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  bulkFailQcInspectionLines,
  bulkPassQcInspectionLines,
} from "@/app/(workspace)/procurement/quality-inspection/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GRN_REJECT_DISPOSITIONS,
  grnRejectDispositionLabel,
  type GrnRejectDisposition,
} from "@/lib/procurement/goods-receipts/grn-reject-dispositions";
import { listControlShellClassName } from "@/lib/products/list-control-shell";

type Props = {
  selectedIds: string[];
  onClearSelection: () => void;
  onCompleted: () => void | Promise<void>;
};

export function QcInspectionBulkToolbar({
  selectedIds,
  onClearSelection,
  onCompleted,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const selectedCount = selectedIds.length;

  if (selectedCount === 0) return null;

  const runBulkPass = () => {
    startTransition(async () => {
      const result = await bulkPassQcInspectionLines(selectedIds);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.failures.length > 0) {
        toast.warning(
          `Passed ${result.passedCount} line(s). ${result.failures.length} could not be bulk-passed.`
        );
      } else {
        toast.success(`Passed ${result.passedCount} line(s).`);
      }
      onClearSelection();
      await onCompleted();
    });
  };

  const runBulkFail = (disposition: GrnRejectDisposition) => {
    startTransition(async () => {
      const result = await bulkFailQcInspectionLines(selectedIds, disposition);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.failures.length > 0) {
        toast.warning(
          `Failed ${result.failedCount} line(s). ${result.failures.length} could not be bulk-failed.`
        );
      } else {
        toast.success(`Rejected ${result.failedCount} line(s).`);
      }
      onClearSelection();
      await onCompleted();
    });
  };

  return (
    <div className={listControlShellClassName()}>
      <p className="text-sm font-medium">{selectedCount} selected</p>
      <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={onClearSelection}>
        Clear
      </Button>
      <Button type="button" size="sm" disabled={isPending} onClick={runBulkPass}>
        Pass all
      </Button>
      <Select
        disabled={isPending}
        onValueChange={(value) => runBulkFail(value as GrnRejectDisposition)}
      >
        <SelectTrigger className="h-8 w-[9rem] text-xs">
          <SelectValue placeholder="Fail all…" />
        </SelectTrigger>
        <SelectContent>
          {GRN_REJECT_DISPOSITIONS.map((disposition) => (
            <SelectItem key={disposition} value={disposition}>
              Fail as {grnRejectDispositionLabel(disposition)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
