import type { DocumentPrintModel } from "@/lib/documents/build-document-print-model";
import {
  DEFAULT_PRESENTATION_SHELL_CONFIG,
  DEFAULT_PRESENTATION_STYLE_CONFIG,
} from "@/lib/documents/print/default-shell-config";
import type {
  DocumentOrgRenderContext,
  DocumentPresentationTemplate,
} from "@/lib/documents/print/types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function documentTitle(
  voucherTitle: string,
  presentation: DocumentPresentationTemplate
): string {
  const override = presentation.shellConfig.header.titleOverride?.trim();
  if (override) return override;
  return voucherTitle;
}

function renderOrgHeader(org: DocumentOrgRenderContext, presentation: DocumentPresentationTemplate): string {
  const { header } = presentation.shellConfig;
  const blocks: string[] = [];

  if (header.showLogo && org.logoUrl) {
    blocks.push(
      `<div class="brand-logo"><img src="${escapeHtml(org.logoUrl)}" alt="" /></div>`
    );
  }

  if (header.showOrgName) {
    const name = org.legalName || org.tradeName || org.organizationName;
    blocks.push(`<div class="brand-name">${escapeHtml(name)}</div>`);
    if (org.tradeName && org.legalName && org.tradeName !== org.legalName) {
      blocks.push(`<div class="brand-trade">${escapeHtml(org.tradeName)}</div>`);
    }
  }

  if (header.showOrgAddress && org.addressLines.length > 0) {
    blocks.push(
      `<div class="brand-address">${org.addressLines.map((line) => escapeHtml(line)).join("<br />")}</div>`
    );
  }

  if (org.taxIdentifier) {
    blocks.push(`<div class="brand-tax">GSTIN / Tax ID: ${escapeHtml(org.taxIdentifier)}</div>`);
  }

  if (org.websiteUrl) {
    blocks.push(`<div class="brand-website">${escapeHtml(org.websiteUrl)}</div>`);
  }

  if (blocks.length === 0) return "";
  return `<div class="letterhead">${blocks.join("")}</div>`;
}

function renderHeaderFields(model: DocumentPrintModel, presentation: DocumentPresentationTemplate): string {
  if (!presentation.shellConfig.sections.showHeaderFields || model.headerFields.length === 0) {
    return "";
  }

  return model.headerFields
    .map(
      (field) =>
        `<div class="field"><div class="label">${escapeHtml(field.label)}</div><div class="value">${escapeHtml(field.value)}</div></div>`
    )
    .join("");
}

function renderLineTable(model: DocumentPrintModel, presentation: DocumentPresentationTemplate): string {
  if (!presentation.shellConfig.sections.showLineTable || model.lineColumns.length === 0) {
    return "";
  }

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

  return `<table><thead><tr>${lineHeader}</tr></thead><tbody>${lineBody}</tbody></table>`;
}

function renderTotals(model: DocumentPrintModel, presentation: DocumentPresentationTemplate): string {
  if (!presentation.shellConfig.sections.showTotals || model.totalsFields.length === 0) {
    return "";
  }

  return model.totalsFields
    .map(
      (field) =>
        `<div class="total-row"><span>${escapeHtml(field.label)}</span><span>${escapeHtml(field.value)}</span></div>`
    )
    .join("");
}

function renderTerms(presentation: DocumentPresentationTemplate): string {
  const { sections } = presentation.shellConfig;
  if (!sections.showTerms || !sections.termsText.trim()) return "";
  return `<div class="terms"><h2>Terms &amp; conditions</h2><p>${escapeHtml(sections.termsText.trim())}</p></div>`;
}

function renderFooter(presentation: DocumentPresentationTemplate): string {
  const legalText = presentation.shellConfig.footer.legalText.trim();
  const statutoryNote = presentation.shellConfig.compliance?.statutoryNote?.trim() ?? "";
  const combined = [legalText, statutoryNote].filter(Boolean).join("\n\n");
  if (!combined) return "";
  return `<div class="footer-legal">${escapeHtml(combined)}</div>`;
}

function renderGstComplianceBlock(
  model: DocumentPrintModel,
  presentation: DocumentPresentationTemplate
): string {
  const compliance = presentation.shellConfig.compliance;
  if (!compliance || compliance.pack !== "gst_tax_invoice") return "";

  const blocks: string[] = [];
  const placeOfSupply = model.headerFields.find((field) => field.id === "tax_supply_nature")?.value;

  if (compliance.showPlaceOfSupply && placeOfSupply && placeOfSupply !== "—") {
    blocks.push(
      `<div class="gst-meta-row"><span class="gst-meta-label">Place of supply</span><span class="gst-meta-value">${escapeHtml(placeOfSupply)}</span></div>`
    );
  }

  if (compliance.showIrnPlaceholder) {
    blocks.push(
      `<div class="gst-irn-grid">
        <div class="gst-irn-field"><span class="gst-meta-label">IRN</span><span class="gst-meta-placeholder">Pending e-invoice integration</span></div>
        <div class="gst-irn-field"><span class="gst-meta-label">Ack No.</span><span class="gst-meta-placeholder">—</span></div>
        <div class="gst-irn-field"><span class="gst-meta-label">Ack Date</span><span class="gst-meta-placeholder">—</span></div>
      </div>`
    );
  }

  if (blocks.length === 0) return "";
  return `<div class="gst-compliance">${blocks.join("")}</div>`;
}

export function renderDocumentHtml(
  voucherTitle: string,
  model: DocumentPrintModel,
  presentation: DocumentPresentationTemplate,
  org: DocumentOrgRenderContext
): string {
  const title = documentTitle(voucherTitle, presentation);
  const { shellConfig, styleConfig } = presentation;
  const letterheadHtml = renderOrgHeader(org, presentation);
  const headerFieldsHtml = renderHeaderFields(model, presentation);
  const lineTableHtml = renderLineTable(model, presentation);
  const totalsHtml = renderTotals(model, presentation);
  const termsHtml = renderTerms(presentation);
  const footerHtml = renderFooter(presentation);
  const gstComplianceHtml = renderGstComplianceBlock(model, presentation);

  const pageMargin = `${shellConfig.margins.top} ${shellConfig.margins.right} ${shellConfig.margins.bottom} ${shellConfig.margins.left}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(voucherTitle)}</title>
  <style>
    @page { size: ${shellConfig.page.size} ${shellConfig.page.orientation}; margin: ${pageMargin}; }
    body {
      font-family: ${styleConfig.fontFamily};
      font-size: ${styleConfig.fontSizePx}px;
      color: #111;
      margin: 0;
      padding: 24px;
    }
    .doc-header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 20px; }
    .letterhead { flex: 1; min-width: 0; }
    .brand-logo img { max-height: 48px; max-width: 180px; object-fit: contain; margin-bottom: 8px; }
    .brand-name { font-size: 16px; font-weight: 700; line-height: 1.3; }
    .brand-trade { font-size: 12px; color: #444; margin-top: 2px; }
    .brand-address, .brand-tax, .brand-website { font-size: 11px; color: #555; margin-top: 4px; line-height: 1.45; }
    .doc-title-block { text-align: right; min-width: 180px; }
    .doc-title { font-size: 20px; font-weight: 700; margin: 0; text-transform: uppercase; letter-spacing: 0.04em; }
    .doc-number { font-size: 13px; font-weight: 600; margin-top: 6px; color: #333; }
    .header-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; margin-bottom: 20px; }
    .field .label { color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
    .field .value { font-size: 13px; font-weight: 600; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; vertical-align: top; }
    th { color: #666; font-size: 10px; text-transform: uppercase; }
    .totals { margin-top: 16px; border-top: 1px solid #ddd; padding-top: 8px; max-width: 360px; margin-left: auto; }
    .total-row { display: flex; justify-content: space-between; gap: 12px; padding: 2px 0; }
    .terms { margin-top: 20px; font-size: 11px; color: #444; }
    .terms h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 6px; color: #666; }
    .footer-legal { margin-top: 24px; padding-top: 8px; border-top: 1px solid #eee; font-size: 10px; color: #666; white-space: pre-line; }
    .gst-compliance { margin-bottom: 16px; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fafafa; }
    .gst-meta-row { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; margin-bottom: 8px; }
    .gst-meta-label { color: #666; text-transform: uppercase; letter-spacing: 0.04em; font-size: 10px; }
    .gst-meta-value { font-weight: 600; }
    .gst-irn-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .gst-irn-field { font-size: 11px; }
    .gst-meta-placeholder { display: block; margin-top: 2px; color: #888; font-style: italic; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="doc-header">
    ${letterheadHtml}
    ${
      presentation.shellConfig.header.showDocumentTitle
        ? `<div class="doc-title-block"><h1 class="doc-title">${escapeHtml(title)}</h1><div class="doc-number">${escapeHtml(voucherTitle)}</div></div>`
        : ""
    }
  </div>
  ${headerFieldsHtml ? `<div class="header-grid">${headerFieldsHtml}</div>` : ""}
  ${gstComplianceHtml}
  ${lineTableHtml}
  ${totalsHtml ? `<div class="totals">${totalsHtml}</div>` : ""}
  ${termsHtml}
  ${footerHtml}
</body>
</html>`;
}

/** @deprecated Use renderDocumentHtml with presentation + org context. */
export function buildDocumentPrintHtml(title: string, model: DocumentPrintModel): string {
  const fallbackPresentation: DocumentPresentationTemplate = {
    templateKey: "legacy",
    moduleKey: model.moduleKey,
    viewContext: "PDF_PRINT",
    label: "Legacy",
    description: null,
    shellConfig: DEFAULT_PRESENTATION_SHELL_CONFIG,
    styleConfig: DEFAULT_PRESENTATION_STYLE_CONFIG,
    isDefault: true,
    isActive: true,
    isCustomized: false,
  };
  const fallbackOrg: DocumentOrgRenderContext = {
    organizationName: "Organization",
    legalName: null,
    tradeName: null,
    taxIdentifier: null,
    addressLines: [],
    logoUrl: null,
    websiteUrl: null,
    locale: "en-US",
  };
  return renderDocumentHtml(title, model, fallbackPresentation, fallbackOrg);
}
