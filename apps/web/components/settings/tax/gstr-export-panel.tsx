"use client";

import { useState, useTransition } from "react";
import { exportGstrReport } from "@/app/procurement/bills/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function GstrExportPanel() {
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [report, setReport] = useState<"GSTR1" | "GSTR2" | "GSTR3B">("GSTR1");
  const [payload, setPayload] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleExport = () => {
    setError(null);
    startTransition(async () => {
      const result = await exportGstrReport(periodStart, periodEnd, report);
      if ("error" in result) {
        setError(result.error ?? "Export failed");
        return;
      }
      setPayload(JSON.stringify(result.data ?? [], null, 2));
    });
  };

  return (
    <div className="surface-inset space-y-4 p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="gstr-start">Period start</Label>
          <Input
            id="gstr-start"
            type="date"
            value={periodStart}
            onChange={(event) => setPeriodStart(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gstr-end">Period end</Label>
          <Input
            id="gstr-end"
            type="date"
            value={periodEnd}
            onChange={(event) => setPeriodEnd(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Report</Label>
          <Select value={report} onValueChange={(value) => setReport(value as typeof report)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GSTR1">GSTR-1 (outward)</SelectItem>
              <SelectItem value="GSTR2">GSTR-2 (inward)</SelectItem>
              <SelectItem value="GSTR3B">GSTR-3B (summary)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button disabled={isPending || !periodStart || !periodEnd} onClick={handleExport}>
        {isPending ? "Exporting…" : "Export JSON"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {payload ? (
        <pre className="max-h-[28rem] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
          {payload}
        </pre>
      ) : null}
    </div>
  );
}
