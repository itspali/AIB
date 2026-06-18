import type { DocumentPrintLine, DocumentPrintField, DocumentPrintModel } from "@/lib/documents/build-document-print-model";
import { DOCUMENT_LAYOUT_MODULE_ADAPTERS } from "@/lib/documents/document-layout-module-adapters";
import {
  documentColumnTypographyStyleAttr,
  printColumnCellStyle,
  printColumnHeaderStyle,
} from "@/lib/documents/document-typography-classes";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { DocumentPrintLayoutHints } from "@/lib/documents/print/print-layout-hints";
import { amountInWordsInr } from "@/lib/documents/print/amount-in-words";
import { renderPrintLineItemDetailsHtml } from "@/lib/documents/print/render-print-line-details";
import {
  DEFAULT_PRESENTATION_SHELL_CONFIG,
  DEFAULT_PRESENTATION_STYLE_CONFIG,
  presentationSpacingToCss,
} from "@/lib/documents/print/default-shell-config";
import {
  normalizePresentationLayoutTheme,
  renderPresentationLayoutThemeCss,
} from "@/lib/documents/print/presentation-layout-themes";
import {
  defaultClosingMessage,
  themeShowsAmountInWords,
  themeShowsPartyBlocks,
  themeUsesTitleBlockMetadata,
} from "@/lib/documents/print/presentation-theme-behavior";
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
  return DOCUMENT_LAYOUT_MODULE_ADAPTERS[presentation.moduleKey]?.label ?? voucherTitle;
}

function renderOrgHeader(org: DocumentOrgRenderContext, presentation: DocumentPresentationTemplate): string {
  const { header } = presentation.shellConfig;
  const orgBlocks: string[] = [];

  if (header.showOrgName) {
    const name = org.legalName || org.tradeName || org.organizationName;
    orgBlocks.push(`<div class="brand-name">${escapeHtml(name)}</div>`);
    if (org.tradeName && org.legalName && org.tradeName !== org.legalName) {
      orgBlocks.push(`<div class="brand-trade">${escapeHtml(org.tradeName)}</div>`);
    }
  }

  if (header.showOrgAddress && org.addressLines.length > 0) {
    orgBlocks.push(
      `<div class="brand-address">${org.addressLines.map((line) => escapeHtml(line)).join("<br />")}</div>`
    );
  }

  if (org.taxIdentifier) {
    orgBlocks.push(`<div class="brand-tax">GSTIN / Tax ID: ${escapeHtml(org.taxIdentifier)}</div>`);
  }

  if (org.websiteUrl) {
    orgBlocks.push(`<div class="brand-website">${escapeHtml(org.websiteUrl)}</div>`);
  }

  const logoHtml =
    header.showLogo && org.logoUrl
      ? `<div class="brand-logo"><img src="${escapeHtml(org.logoUrl)}" alt="" style="max-height:${header.logoMaxHeightPx}px;max-width:${header.logoMaxWidthPx}px;object-fit:contain;" /></div>`
      : "";

  if (!logoHtml && orgBlocks.length === 0) return "";

  const placementClass = header.logoPlacement === "left" ? "letterhead--left" : "letterhead--top";
  const orgHtml = orgBlocks.length > 0 ? `<div class="brand-org">${orgBlocks.join("")}</div>` : "";

  return `<div class="letterhead ${placementClass}">${logoHtml}${orgHtml}</div>`;
}

function filteredHeaderFields(model: DocumentPrintModel, keepStatusField = false) {
  return model.headerFields.filter((field) => {
    if (!keepStatusField && model.statusBadge && field.id === "document_status") return false;
    if (model.addressBlocks?.length && field.id === "customer") return false;
    return true;
  });
}

function renderTitleBlockMetadata(fields: DocumentPrintField[]): string {
  if (fields.length === 0) return "";
  const rows = fields
    .map(
      (field) =>
        `<div class="title-meta-row"><span class="title-meta-label"${documentColumnTypographyStyleAttr(field, "label")}>${escapeHtml(field.label)}</span><span class="title-meta-value"${documentColumnTypographyStyleAttr(field, "value")}>${escapeHtml(field.value)}</span></div>`
    )
    .join("");
  return `<div class="title-meta">${rows}</div>`;
}

function renderDocTitleBlock(
  title: string,
  voucherTitle: string,
  model: DocumentPrintModel,
  presentation: DocumentPresentationTemplate,
  layoutTheme: PresentationLayoutTheme
): string {
  if (!presentation.shellConfig.header.showDocumentTitle) {
    return model.statusBadge
      ? `<div class="doc-status-badge">${escapeHtml(model.statusBadge)}</div>`
      : "";
  }

  const useTitleMeta = themeUsesTitleBlockMetadata(layoutTheme);
  const headerFields = filteredHeaderFields(model, useTitleMeta);
  const titleMetaHtml =
    useTitleMeta && presentation.shellConfig.sections.showHeaderFields
      ? renderTitleBlockMetadata(headerFields)
      : "";

  const statusBadgeHtml =
    !useTitleMeta && model.statusBadge
      ? `<div class="doc-status-badge">${escapeHtml(model.statusBadge)}</div>`
      : "";

  const docNumberHtml = useTitleMeta ? "" : `<div class="doc-number">${escapeHtml(voucherTitle)}</div>`;

  return `<div class="doc-title-block"><h1 class="doc-title">${escapeHtml(title)}</h1>${docNumberHtml}${titleMetaHtml}${statusBadgeHtml}</div>`;
}

function renderHeaderFields(
  model: DocumentPrintModel,
  presentation: DocumentPresentationTemplate,
  layoutTheme: PresentationLayoutTheme
): string {
  if (!presentation.shellConfig.sections.showHeaderFields) return "";

  const fields = filteredHeaderFields(model, themeUsesTitleBlockMetadata(layoutTheme));
  if (fields.length === 0) return "";

  if (themeUsesTitleBlockMetadata(layoutTheme)) return "";

  if (layoutTheme === "modern") {
    const rows = fields
      .map(
        (field) =>
          `<div class="meta-row"><span class="meta-label"${documentColumnTypographyStyleAttr(field, "label")}>${escapeHtml(field.label)}</span><span class="meta-value"${documentColumnTypographyStyleAttr(field, "value")}>${escapeHtml(field.value)}</span></div>`
      )
      .join("");
    return `<div class="metadata-panel">${rows}</div>`;
  }

  return `<div class="header-grid">${fields
    .map(
      (field) =>
        `<div class="field"><div class="label"${documentColumnTypographyStyleAttr(field, "label")}>${escapeHtml(field.label)}</div><div class="value"${documentColumnTypographyStyleAttr(field, "value")}>${escapeHtml(field.value)}</div></div>`
    )
    .join("")}</div>`;
}

function renderPartyBlocks(model: DocumentPrintModel, layoutTheme: PresentationLayoutTheme): string {
  if (!themeShowsPartyBlocks(layoutTheme) || !model.addressBlocks?.length) return "";

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
  const cellStyle = printColumnCellStyle(column);
  const qtyValue = escapeHtml(line[column.id] ?? "—");
  const showUnit =
    hints?.showUnitUnderQty === true && hints.quantityColumnIds.includes(column.id);
  if (!showUnit) {
    return `<td style="${cellStyle}">${qtyValue}</td>`;
  }

  const unitRaw = line[hints.unitFieldId];
  const unitValue = unitRaw && unitRaw !== "—" ? escapeHtml(unitRaw) : "";
  if (!unitValue) {
    return `<td style="${cellStyle}">${qtyValue}</td>`;
  }

  return `<td class="line-qty-cell" style="${cellStyle}"><div class="line-qty-value">${qtyValue}</div><div class="line-qty-unit">${unitValue}</div></td>`;
}

function renderLineTable(model: DocumentPrintModel, presentation: DocumentPresentationTemplate): string {
  if (!presentation.shellConfig.sections.showLineTable || model.lineColumns.length === 0) {
    return "";
  }

  const itemDetailColumns = model.itemDetailColumns ?? [];
  const lineHeader = model.lineColumns
    .map((column) => `<th style="${printColumnHeaderStyle(column)}">${escapeHtml(column.label)}</th>`)
    .join("");

  const lineBody = model.lines
    .map((line) => {
      const cells = model.lineColumns
        .map((column) => {
          const cellStyle = printColumnCellStyle(column);
          const rawValue = line[column.id] ?? "—";

          if (column.id === "item" && itemDetailColumns.length > 0) {
            const detailHtml = renderPrintLineItemDetailsHtml(itemDetailColumns, line);
            const itemHtml = `<div class="line-item-name"${documentColumnTypographyStyleAttr(column, "value")}>${escapeHtml(rawValue)}</div>${detailHtml}`;
            return `<td class="line-item-cell" style="${cellStyle}">${itemHtml}</td>`;
          }

          if (model.printLayoutHints?.quantityColumnIds.includes(column.id)) {
            return renderPrintQtyCellHtml(column, line, model.printLayoutHints);
          }

          return `<td style="${cellStyle}">${escapeHtml(rawValue)}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<table><thead><tr>${lineHeader}</tr></thead><tbody>${lineBody}</tbody></table>`;
}

function renderTotals(
  model: DocumentPrintModel,
  presentation: DocumentPresentationTemplate,
  layoutTheme: PresentationLayoutTheme
): string {
  if (!presentation.shellConfig.sections.showTotals || model.totalsFields.length === 0) {
    return "";
  }

  const rows = model.totalsFields
    .map(
      (field) =>
        `<div class="total-row"><span${documentColumnTypographyStyleAttr(field, "label")}>${escapeHtml(field.label)}</span><span${documentColumnTypographyStyleAttr(field, "value")}>${escapeHtml(field.value)}</span></div>`
    )
    .join("");

  let amountWordsHtml = "";
  if (themeShowsAmountInWords(layoutTheme)) {
    const grandTotalField = model.totalsFields.find((field) => field.id === "grand_total");
    const words = grandTotalField ? amountInWordsInr(grandTotalField.value) : null;
    if (words) {
      amountWordsHtml = `<div class="total-row total-row--words"><span>Amount in words</span><span>${escapeHtml(words)}</span></div>`;
    }
  }

  return `<div class="totals">${rows}${amountWordsHtml}</div>`;
}

function renderClosingMessage(
  presentation: DocumentPresentationTemplate,
  layoutTheme: PresentationLayoutTheme,
  org: DocumentOrgRenderContext
): string {
  const orgName = org.legalName || org.tradeName || org.organizationName;
  const message = defaultClosingMessage(layoutTheme, orgName);
  if (!message) return "";
  if (presentation.shellConfig.footer.legalText.trim()) return "";
  return `<div class="closing-message">${escapeHtml(message)}</div>`;
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
  const partyBlocksHtml = renderPartyBlocks(model, layoutTheme);
  const lineTableHtml = renderLineTable(model, presentation);
  const totalsHtml = renderTotals(model, presentation, layoutTheme);
  const termsHtml = renderTerms(presentation);
  const closingMessageHtml = renderClosingMessage(presentation, layoutTheme, org);
  const footerHtml = renderFooter(presentation);
  const gstComplianceHtml = renderGstComplianceBlock(model, presentation);
  const docTitleBlockHtml = renderDocTitleBlock(title, voucherTitle, model, presentation, layoutTheme);

  const pageMargin = presentationSpacingToCss(shellConfig.margins);
  const bodyPadding = presentationSpacingToCss(shellConfig.padding);

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
      padding: ${bodyPadding};
    }
    .doc-header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 20px; }
    .letterhead { flex: 1; min-width: 0; }
    .letterhead--top { display: flex; flex-direction: column; align-items: flex-start; }
    .letterhead--top .brand-logo img { margin-bottom: 8px; }
    .letterhead--left { display: flex; flex-direction: row; align-items: flex-start; gap: 12px; }
    .letterhead--left .brand-logo { flex-shrink: 0; }
    .letterhead--left .brand-org { flex: 1; min-width: 0; }
    .brand-logo img { display: block; object-fit: contain; }
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
    ${docTitleBlockHtml}
  </div>
  ${headerFieldsHtml}
  ${partyBlocksHtml}
  ${gstComplianceHtml}
  ${lineTableHtml}
  ${totalsHtml}
  ${termsHtml}
  ${closingMessageHtml}
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
