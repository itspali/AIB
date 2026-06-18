export { buildDocumentPrintHtml } from "@/lib/documents/print/render-document-html";

const PRINT_WINDOW_FEATURES = "width=900,height=700";

/** Open a blank print window synchronously while the user gesture is still active. */
export function prepareDocumentPrintWindow(): Window {
  const printWindow = window.open("about:blank", "_blank", PRINT_WINDOW_FEATURES);
  if (!printWindow) {
    throw new Error("Popup blocked. Allow popups for this site to print.");
  }

  printWindow.document.open();
  printWindow.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Preparing…</title></head><body style="font-family:system-ui,sans-serif;padding:24px;color:#444;">Preparing document for print…</body></html>`
  );
  printWindow.document.close();
  printWindow.focus();

  return printWindow;
}

function triggerPrintWhenReady(printWindow: Window): void {
  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
  };

  if (printWindow.document.readyState === "complete") {
    window.setTimeout(triggerPrint, 0);
    return;
  }

  printWindow.addEventListener("load", triggerPrint, { once: true });
}

/** Write rendered HTML into an already-open print window and open the print dialog. */
export function renderDocumentPrintWindow(
  printWindow: Window,
  title: string,
  html: string
): void {
  if (printWindow.closed) {
    throw new Error("Print window was closed before the document was ready.");
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.document.title = title;
  printWindow.focus();
  triggerPrintWhenReady(printWindow);
}

export function openDocumentPrintHtml(title: string, html: string): void {
  const printWindow = prepareDocumentPrintWindow();
  renderDocumentPrintWindow(printWindow, title, html);
}

/** Opens the browser print dialog with pre-rendered document HTML. */
export function openDocumentPrintWindow(title: string, html: string): void {
  openDocumentPrintHtml(title, html);
}
