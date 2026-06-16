import { buildCatalogFieldId } from "@/lib/documents/catalog-field-ids";
import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import type { DocumentCatalogFieldSource, DocumentColumnPref, DocumentLayoutTemplate } from "@/lib/documents/types";

export const HSN_CATALOG_FIELD_ID = buildCatalogFieldId("item_column", "hsn_sac_code");

export const GST_MANDATORY_HSN_DISABLED_REASON =
  "Required for GST-registered organizations.";

type CreateCatalogPrefFn = (
  source: DocumentCatalogFieldSource,
  key: string,
  label?: string
) => DocumentColumnPref;

export function createHsnSacCatalogFieldPref(
  createPref: CreateCatalogPrefFn = defaultHsnCatalogFieldPref
): DocumentColumnPref {
  return createPref("item_column", "hsn_sac_code", "HSN/SAC");
}

function defaultHsnCatalogFieldPref(
  source: DocumentCatalogFieldSource,
  key: string,
  label?: string
): DocumentColumnPref {
  return {
    id: buildCatalogFieldId(source, key),
    label: label ?? "HSN/SAC",
    defaultVisible: true,
    group: "catalog",
    lineSlot: "item_detail",
    showLabel: true,
    itemDetailFlow: "new_line",
    catalogSource: source,
    catalogSourceKey: key,
  };
}

/** Force HSN/SAC visible under item lines when the org is GST registered. */
export function applyGstRegisteredDocumentLayoutOverrides(
  layout: DocumentLayoutTemplate,
  gstRegistered: boolean,
  createPref: CreateCatalogPrefFn = defaultHsnCatalogFieldPref
): DocumentLayoutTemplate {
  if (!gstRegistered) return layout;

  const hsnPref =
    layout.columns.find((column) => column.id === HSN_CATALOG_FIELD_ID) ??
    createHsnSacCatalogFieldPref(createPref);

  const columns = layout.columns.some((column) => column.id === HSN_CATALOG_FIELD_ID)
    ? layout.columns.map((column) =>
        column.id === HSN_CATALOG_FIELD_ID ? { ...column, defaultVisible: true } : column
      )
    : [...layout.columns, { ...hsnPref, defaultVisible: true }];

  const catalogLineFieldOrder = layout.catalogLineFieldOrder.includes(HSN_CATALOG_FIELD_ID)
    ? layout.catalogLineFieldOrder
    : [...layout.catalogLineFieldOrder, HSN_CATALOG_FIELD_ID];

  return { ...layout, columns, catalogLineFieldOrder };
}

export function isGstMandatoryCatalogFieldId(
  fieldId: string,
  gstRegistered: boolean
): boolean {
  return gstRegistered && fieldId === HSN_CATALOG_FIELD_ID;
}

export function patchCatalogLineHsnSacCode<T extends { catalog_context?: PoLineCatalogContext | null }>(
  line: T,
  hsnSacCode: string
): Partial<T> {
  if (!line.catalog_context) return {};
  const normalized = hsnSacCode.trim();
  return {
    catalog_context: {
      ...line.catalog_context,
      hsn_sac_code: normalized || null,
    },
  } as Partial<T>;
}
