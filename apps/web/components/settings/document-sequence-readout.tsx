"use client";

import type { DocumentSequenceRow } from "@/lib/organization/types";

type Props = {
  rows: DocumentSequenceRow[];
};

export function DocumentSequenceReadout({ rows }: Props) {
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No live document sequence counters have been initialized yet. Prefix changes will bootstrap
        counters on save when voucher types match.
      </p>
    );
  }

  return (
    <div className="surface-inset overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th className="p-3 font-medium text-muted-foreground">Voucher type</th>
            <th className="p-3 font-medium text-muted-foreground">Prefix</th>
            <th className="p-3 font-medium text-muted-foreground">Next value</th>
            <th className="p-3 font-medium text-muted-foreground">Padding</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0">
              <td className="p-3">{row.voucher_type.replace(/_/g, " ")}</td>
              <td className="p-3 font-mono">{row.prefix}</td>
              <td className="p-3 text-right font-mono">{row.next_value}</td>
              <td className="p-3 text-right font-mono">{row.padding_length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
