export { buildDocumentPrintHtml } from "@/lib/documents/print/render-document-html";

export function openDocumentPrintHtml(title: string, html: string): void {
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

/** Opens the browser print dialog with pre-rendered document HTML. */
export function openDocumentPrintWindow(title: string, html: string): void {
  void title;
  openDocumentPrintHtml(title, html);
}
