# Document Print & PDF Templates

Blueprint for centralized print/PDF presentation across all ERP document modules.

## Architecture: three layers

| Layer | Responsibility | Storage (today) |
|-------|----------------|-----------------|
| **Content layout** | Which fields appear, order, labels, decimals | `document_layout_templates` |
| **Presentation shell** | Letterhead, page layout, sections, styling | `document_presentation_templates` (MVP) |
| **Notification wrapper** | Email subject/body around attachments | `notification_templates` |

**Render pipeline:**

```
Document row
  → resolveEffectiveDocumentLayout (fields)
  → resolveEffectivePresentationTemplate (shell)
  → buildDocumentPrintModel (content)
  → renderDocumentHtml (model + presentation + org context)
  → browser print | Puppeteer PDF | email attachment
```

Resolution order for both layout and presentation: **location override → tenant default → system default → code fallback**.

## MVP scope (implemented)

- [x] `document_presentation_system_defaults` + `document_presentation_templates` tables with RLS
- [x] `ensure_tenant_presentation_templates` RPC (seed on first settings visit)
- [x] `lib/documents/print/` — types, shell config, queries, resolver, org context, HTML renderer
- [x] Print and email flows use unified renderer with org branding (logo, legal name, address, GSTIN)
- [x] Settings hub at `/settings/documents/templates` with per-module appearance editor
- [x] Administration nav entry
- [x] **PDF download** via Print menu → Download PDF (`downloadDocumentPdf` + Puppeteer)
- [x] **Location-aware letterhead** — document origin location overrides registered name, address, GSTIN
- [x] **Location scope** in presentation template settings (per-location appearance overrides)
- [x] **`DocumentPrintAdapter` registry** — `document-print-registry.ts` + `resolve-document-render.ts`

- [x] **GST tax invoice presentation pack** — IRN placeholder, place of supply, statutory note for GST-registered orgs on sales invoices
- [x] **Sales invoice print** — adapter, print model, drawer Print menu

**Not yet implemented:**

- Multi-template picker per document
- PDF Storage cache
- Compliance packs (GST tax invoice layout, e-invoice IRN slot)
- Template versioning / freeze at issue
- Custom HTML blocks

## File map

```
apps/web/lib/documents/print/
  types.ts
  default-shell-config.ts
  presentation-catalog.ts
  presentation-persistence.ts
  presentation-queries.ts
  resolve-effective-presentation.ts
  document-print-registry.ts
  resolve-document-render.ts
  org-render-context.ts
  render-document-html.ts

apps/web/lib/documents/
  document-print-actions.ts      # loadDocumentPrintPayload, downloadDocumentPdf
  download-document-pdf.ts       # client blob download helper

apps/web/app/settings/documents/templates/
  page.tsx
  [moduleKey]/page.tsx
  actions.ts

apps/web/components/settings/document-templates/
  document-templates-hub.tsx
  presentation-template-panel.tsx

supabase/migrations/20260717160000_document_presentation_templates.sql
```

## `shell_config` schema (v1)

```json
{
  "version": 1,
  "page": { "size": "A4", "orientation": "portrait" },
  "margins": { "top": "12mm", "bottom": "12mm", "left": "10mm", "right": "10mm" },
  "header": {
    "showLogo": true,
    "showOrgName": true,
    "showOrgAddress": true,
    "showDocumentTitle": true,
    "titleOverride": null
  },
  "footer": {
    "showPageNumbers": false,
    "legalText": ""
  },
  "sections": {
    "showHeaderFields": true,
    "showLineTable": true,
    "showTotals": true,
    "showTerms": false,
    "termsText": ""
  }
}
```

## Module onboarding checklist

When adding print support for a new `DocumentModuleKey`:

1. Layout adapter in `document-layout-module-adapters.ts` (if not present)
2. Print model mapping in `build-document-print-model.ts` (or future `DocumentPrintAdapter`)
3. Seed row in `document_presentation_system_defaults`
4. Register in `presentation-catalog.ts` and settings hub
5. `loadDocumentPrintPayload` branch + `DocumentPrintButton` on drawer/peek
6. Optional: `notification_templates` event for email with PDF attachment

## Advanced tiers (future)

| Tier | Features |
|------|----------|
| **A — Compliance** | GST tax invoice pack, HSN summary annexure, e-invoice IRN/QR placeholder, export/SEZ variants |
| **B — Multi-entity branding** | Location letterhead, sales channel branding, party address blocks, bank footer |
| **C — Template intelligence** | Auto-select by status/currency/tax nature, conditional sections, draft/cancelled watermarks |
| **D — Rich content** | Line images in PDF, catalog fields, entity custom fields, multi-page tables |
| **E — Output automation** | PDF cache in Storage, bulk ZIP, lifecycle hooks, verification QR |
| **F — Governance** | Draft/publish, version history, freeze template at document issue |
| **G — Power user** | Block-based section editor, then sandboxed custom HTML |

See conversation plan for full advanced breakdown.

## Related docs

- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) — settings UI patterns
- [GST_COMPLIANCE.md](./GST_COMPLIANCE.md) — field-level GST layout overrides
- Field layouts: `/settings/modules/{procurement,sales}` (On-screen / Print / Email tabs)
