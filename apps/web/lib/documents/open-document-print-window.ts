import type { DocumentPrintModel } from "@/lib/documents/build-document-print-model";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildDocumentPrintHtml(title: string, model: DocumentPrintModel): string {
  const headerHtml = model.headerFields
    .map(
      (field) =>
        `<div class="field"><div class="label">${escapeHtml(field.label)}</div><div class="value">${escapeHtml(field.value)}</div></div>`
    )
    .join("");

  const lineHeader = model.lineColumns
    .map((column) => {
      const align = column.align === "right" ? "right" : column.align === "center" ? "center" : "left";
      return `<th style="text-align:${align}">${escapeHtml(column.label)}</th>`;
    })
    .join("");

  const lineBody = model.lines
    .map((line) => {
      const cells = model.lineColumns
        .map((column) => {
          const align = column.align === "right" ? "right" : column.align === "center" ? "center" : "left";
          return `<td style="text-align:${align}">${escapeHtml(line[column.id] ?? "—")}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const totalsHtml = model.totalsFields
    .map(
      (field) =>
        `<div class="total-row"><span>${escapeHtml(field.label)}</span><span>${escapeHtml(field.value)}</span></div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 16px; }
    .header-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; margin-bottom: 20px; }
    .field .label { color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
    .field .value { font-size: 13px; font-weight: 600; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; vertical-align: top; }
    th { color: #666; font-size: 10px; text-transform: uppercase; }
    .totals { margin-top: 16px; border-top: 1px solid #ddd; padding-top: 8px; }
    .total-row { display: flex; justify-content: space-between; gap: 12px; padding: 2px 0; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="header-grid">${headerHtml}</div>
  <table>
    <thead><tr>${lineHeader}</tr></thead>
    <tbody>${lineBody}</tbody>
  </table>
  ${totalsHtml ? `<div class="totals">${totalsHtml}</div>` : ""}
</body>
</html>`;
}

export function openDocumentPrintWindow(title: string, model: DocumentPrintModel): void {
  const html = buildDocumentPrintHtml(title, model);
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
  };
}
