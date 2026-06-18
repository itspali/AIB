import type { DocumentPrintLine, DocumentPrintModel } from "@/lib/documents/build-document-print-model";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { DocumentPrintLayoutHints } from "@/lib/documents/print/print-layout-hints";
import { renderPrintLineItemDetailsHtml } from "@/lib/documents/print/render-print-line-details";
import {
  DEFAULT_PRESENTATION_SHELL_CONFIG,
  DEFAULT_PRESENTATION_STYLE_CONFIG,
} from "@/lib/documents/print/default-shell-config";
import {
  normalizePresentationLayoutTheme,
  renderPresentationLayoutThemeCss,
} from "@/lib/documents/print/presentation-layout-themes";
import type {
  DocumentOrgRenderContext,
  DocumentPresentationTemplate,
  PresentationLayoutTheme,
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

function filteredHeaderFields(model: DocumentPrintModel) {
  return model.headerFields.filter((field) => {
    if (model.statusBadge && field.id === "document_status") return false;
    if (model.addressBlocks?.length && field.id === "customer") return false;
    return true;
  });
}

function renderHeaderFields(
  model: DocumentPrintModel,
  presentation: DocumentPresentationTemplate,
  layoutTheme: PresentationLayoutTheme
): string {
  if (!presentation.shellConfig.sections.showHeaderFields) return "";

  const fields = filteredHeaderFields(model);
  if (fields.length === 0) return "";

  if (layoutTheme === "modern") {
    const rows = fields
      .map(
        (field) =>
          `<div class="meta-row"><span class="meta-label">${escapeHtml(field.label)}</span><span class="meta-value">${escapeHtml(field.value)}</span></div>`
      )
      .join("");
    return `<div class="metadata-panel">${rows}</div>`;
  }

  return `<div class="header-grid">${fields
    .map(
      (field) =>
        `<div class="field"><div class="label">${escapeHtml(field.label)}</div><div class="value">${escapeHtml(field.value)}</div></div>`
    )
    .join("")}</div>`;
}

function renderPartyBlocks(model: DocumentPrintModel): string {
  if (!model.addressBlocks?.length) return "";

  return `<div class="party-blocks">${model.addressBlocks
    .map(
      (block) =>
        `<div class="party-block party-block--${escapeHtml(block.kind)}">
          <div class="party-block__title">${escapeHtml(block.title)}</div>
          <div class="party-block__name">${escapeHtml(block.name)}</div>
          ${block.lines.map((line) => `<div class="party-block__line">${escapeHtml(line)}</div>`).join("")}
          ${
            block.taxIdentifier
              ? `<div class="party-block__tax">GSTIN: ${escapeHtml(block.taxIdentifier)}</div>`
              : ""
          }
        </div>`
    )
    .join("")}</div>`;
}

function renderPrintQtyCellHtml(
  column: DocumentColumnPref,
  line: DocumentPrintLine,
  hints: DocumentPrintLayoutHints | undefined
): string {
  const align = column.align === "right" ? "right" : column.align === "center" ? "center" : "left";
  const weight =
    column.typography?.fontWeight === "bold" || column.typography?.fontWeight === "semibold"
      ? "font-weight:600;"
      : "";
  const qtyValue = escapeHtml(line[column.id] ?? "—");
  const showUnit =
    hints?.showUnitUnderQty === true && hints.quantityColumnIds.includes(column.id);
  if (!showUnit) {
    return `<td style="text-align:${align};${weight}">${qtyValue}</td>`;
  }

  const unitRaw = line[hints.unitFieldId];
  const unitValue = unitRaw && unitRaw !== "—" ? escapeHtml(unitRaw) : "";
  if (!unitValue) {
    return `<td style="text-align:${align};${weight}">${qtyValue}</td>`;
  }

  return `<td class="line-qty-cell" style="text-align:${align};${weight}"><div class="line-qty-value">${qtyValue}</div><div class="line-qty-unit">${unitValue}</div></td>`;
}

function renderLineTable(model: DocumentPrintModel, presentation: DocumentPresentationTemplate): string {
  if (!presentation.shellConfig.sections.showLineTable || model.lineColumns.length === 0) {
    return "";
  }

  const itemDetailColumns = model.itemDetailColumns ?? [];
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
          const weight =
            column.typography?.fontWeight === "bold" || column.typography?.fontWeight === "semibold"
              ? "font-weight:600;"
              : "";
          const rawValue = line[column.id] ?? "—";

          if (column.id === "item" && itemDetailColumns.length > 0) {
            const detailHtml = renderPrintLineItemDetailsHtml(itemDetailColumns, line);
            const itemHtml = `<div class="line-item-name">${escapeHtml(rawValue)}</div>${detailHtml}`;
            return `<td class="line-item-cell" style="text-align:${align};${weight}">${itemHtml}</td>`;
          }

          if (model.printLayoutHints?.quantityColumnIds.includes(column.id)) {
            return renderPrintQtyCellHtml(column, line, model.printLayoutHints);
          }

          return `<td style="text-align:${align};${weight}">${escapeHtml(rawValue)}</td>`;
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

  return `<div class="totals">${model.totalsFields
    .map(
      (field) =>
        `<div class="total-row"><span>${escapeHtml(field.label)}</span><span>${escapeHtml(field.value)}</span></div>`
    )
    .join("")}</div>`;
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
  const layoutTheme = normalizePresentationLayoutTheme(styleConfig.layoutTheme);
  const themeCss = renderPresentationLayoutThemeCss(layoutTheme);
  const letterheadHtml = renderOrgHeader(org, presentation);
  const headerFieldsHtml = renderHeaderFields(model, presentation, layoutTheme);
  const partyBlocksHtml = renderPartyBlocks(model);
  const lineTableHtml = renderLineTable(model, presentation);
  const totalsHtml = renderTotals(model, presentation);
  const termsHtml = renderTerms(presentation);
  const footerHtml = renderFooter(presentation);
  const gstComplianceHtml = renderGstComplianceBlock(model, presentation);
  const statusBadgeHtml = model.statusBadge
    ? `<div class="doc-status-badge">${escapeHtml(model.statusBadge)}</div>`
    : "";

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
    .doc-status-badge { display: none; }
    .header-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; margin-bottom: 20px; }
    .field .label { color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
    .field .value { font-size: 13px; font-weight: 600; margin-top: 2px; }
    .party-blocks { display: none; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; vertical-align: top; }
    th { color: #666; font-size: 10px; text-transform: uppercase; }
    .line-item-name { font-weight: 600; line-height: 1.35; }
    .line-detail { margin-top: 4px; padding-top: 4px; border-top: 1px solid #eee; font-size: 9px; line-height: 1.45; color: #64748b; }
    .line-detail__row + .line-detail__row { margin-top: 2px; }
    .line-detail__row--inline { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 6px; }
    .line-detail__label { color: #94a3b8; font-weight: 500; }
    .line-detail__value { color: #334155; }
    .line-detail__sep { color: #cbd5e1; }
    .line-qty-cell { vertical-align: top; }
    .line-qty-value { line-height: 1.35; }
    .line-qty-unit { margin-top: 2px; font-size: 8px; line-height: 1.3; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }
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
    ${themeCss}
    @media print { body { padding: 0; } }
  </style>
</head>
<body class="theme-${layoutTheme}">
  <div class="doc-header">
    ${letterheadHtml}
    ${
      presentation.shellConfig.header.showDocumentTitle
        ? `<div class="doc-title-block"><h1 class="doc-title">${escapeHtml(title)}</h1><div class="doc-number">${escapeHtml(voucherTitle)}</div>${statusBadgeHtml}</div>`
        : statusBadgeHtml
    }
  </div>
  ${headerFieldsHtml}
  ${partyBlocksHtml}
  ${gstComplianceHtml}
  ${lineTableHtml}
  ${totalsHtml}
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
