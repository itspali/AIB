"use client";

import {
  DocumentLineCompactInput,
  DocumentLineReadOnlyItemCell,
} from "@/components/documents/document-line-entry-cells";
import {
  DocumentLineEntryGrid,
  DocumentLineEntrySection,
  type DocumentLineColumn,
} from "@/components/documents/document-line-entry-grid";

export type TransferReceiptLine = {
  line_id: string;
  item_name: string;
  variant_sku: string;
  quantity_dispatched: string;
  quantity_accepted: string;
  quantity_damaged: string;
  quantity_lost: string;
};

type Props = {
  lines: TransferReceiptLine[];
  disabled?: boolean;
  onChange: (lines: TransferReceiptLine[]) => void;
};

const RECEIPT_COLUMNS: DocumentLineColumn[] = [
  {
    id: "item",
    label: "Item",
    align: "left",
    widthClass: "min-w-[12rem] w-auto sm:min-w-[16rem]",
    editable: false,
  },
  {
    id: "quantity_accepted",
    label: "Accepted",
    align: "right",
    widthClass: "w-[5rem]",
    editable: true,
  },
  {
    id: "quantity_damaged",
    label: "Damaged",
    align: "right",
    widthClass: "w-[5rem]",
    editable: true,
  },
  {
    id: "quantity_lost",
    label: "Lost",
    align: "right",
    widthClass: "w-[5rem]",
    editable: true,
  },
];

export function TransferReceiptLineEntryTable({
  lines,
  disabled = false,
  onChange,
}: Props) {
  const patchLine = (lineId: string, patch: Partial<TransferReceiptLine>) => {
    onChange(lines.map((line) => (line.line_id === lineId ? { ...line, ...patch } : line)));
  };

  return (
    <DocumentLineEntrySection title="Receipt quantities">
      <p className="-mt-1 text-xs text-muted-foreground">
        Accepted + damaged + lost must equal dispatched quantity on every line.
      </p>
      <DocumentLineEntryGrid
        lines={lines.map((line) => ({ key: line.line_id, ...line }))}
        columns={RECEIPT_COLUMNS}
        minTableWidth="min-w-[36rem]"
        disabled={disabled}
        showRemoveColumn={false}
        renderCell={(column, line) => {
          if (column.id === "item") {
            return (
              <DocumentLineReadOnlyItemCell
                itemName={line.item_name}
                variantSku={line.variant_sku}
                hint={`Dispatched: ${line.quantity_dispatched}`}
              />
            );
          }

          if (column.id === "quantity_accepted") {
            return (
              <DocumentLineCompactInput
                align="right"
                value={line.quantity_accepted}
                disabled={disabled}
                inputMode="decimal"
                aria-label="Accepted quantity"
                onChange={(event) =>
                  patchLine(line.line_id, { quantity_accepted: event.target.value })
                }
              />
            );
          }

          if (column.id === "quantity_damaged") {
            return (
              <DocumentLineCompactInput
                align="right"
                value={line.quantity_damaged}
                disabled={disabled}
                inputMode="decimal"
                aria-label="Damaged quantity"
                onChange={(event) =>
                  patchLine(line.line_id, { quantity_damaged: event.target.value })
                }
              />
            );
          }

          if (column.id === "quantity_lost") {
            return (
              <DocumentLineCompactInput
                align="right"
                value={line.quantity_lost}
                disabled={disabled}
                inputMode="decimal"
                aria-label="Lost quantity"
                onChange={(event) =>
                  patchLine(line.line_id, { quantity_lost: event.target.value })
                }
              />
            );
          }

          return null;
        }}
      />
    </DocumentLineEntrySection>
  );
}
