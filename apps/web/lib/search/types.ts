export type FilterScope = "all" | "items" | "locations" | "categories" | "settings";

export type FilterOperator =
  | "EQ"
  | "NEQ"
  | "GT"
  | "GTE"
  | "LT"
  | "LTE"
  | "IN"
  | "BETWEEN"
  | "FIELD_GT"
  | "FIELD_GTE"
  | "FIELD_LT"
  | "FIELD_LTE"
  | "ILIKE"
  | "NOT_ILIKE"
  | "IS_NULL"
  | "IS_NOT_NULL";

export type AstPredicate = {
  kind: "predicate";
  field: string;
  operator: FilterOperator;
  value: unknown;
};

export type AstFieldCompare = {
  kind: "field_compare";
  left: string;
  operator: FilterOperator;
  right: string;
};

export type AstText = {
  kind: "text";
  value: string;
};

export type AstClause = AstPredicate | AstFieldCompare | AstText;

export type CompileResult = {
  ast: AstClause[];
  unparsedTokens: string[];
  compileMicros: number;
  residualText: string;
  /** Source segment text for each structural (non-text) AST clause, in order. */
  clauseSegments: string[];
};

export type OmnibarHintKind =
  | "field"
  | "operator"
  | "example"
  | "navigation"
  | "value"
  | "recent";

export type OmnibarHint = {
  label: string;
  insertText: string;
  kind: OmnibarHintKind;
  href?: string;
  query?: string;
};

export type FieldSensitivity = "standard" | "financial";

export type FieldValueType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "enum"
  | "fieldRef"
  | "image";

export type FieldValueSource =
  | "categories"
  | "classifications"
  | "uom"
  | "locationTypes"
  | "cities";

export type FieldMetadata = {
  valueType: FieldValueType;
  allowedOperators: FilterOperator[];
  valueSource?: FieldValueSource;
  supportsMultiValue?: boolean;
  supportsBetween?: boolean;
  supportsCompound?: boolean;
};

export type CriterionDraftPart = {
  operator: FilterOperator;
  value: unknown;
};

export type CriterionDraft = {
  field: string;
  parts: CriterionDraftPart[];
};

export type FilterValueOption = {
  value: string;
  label: string;
};

export type FieldRegistryEntry = {
  key: string;
  synonyms: string[];
  sensitivity: FieldSensitivity;
  scopes: FilterScope[];
};

export type ResolvedFieldDictEntry = {
  key: string;
  synonyms: string[];
};

export type SearchFieldPermissions = {
  financialVisible: boolean;
  allowedFields: string[];
  throttled: boolean;
};

export type TelemetryPayload = {
  scope: FilterScope;
  rawQuery: string;
  unparsedTokens: string[];
  ast: AstClause[];
  compileMicros: number;
  executionMs?: number;
  performanceWarning?: boolean;
  securityFlag?: boolean;
};

export type ModuleFilterResult =
  | { ok: true; itemIds: string[]; executionMs: number }
  | { ok: false; error: string; field?: string; throttled?: boolean };

export type NavigationIndexEntry = {
  label: string;
  href: string;
  keywords: string[];
};

export type CustomModuleView = {
  id: string;
  tenant_id: string;
  user_id: string;
  module_name: string;
  view_name: string;
  raw_search_text: string;
  compiled_ast: AstClause[];
  is_system_default: boolean;
  created_at: string;
  updated_at: string;
};

export type SaveCustomModuleViewPayload = {
  moduleName: string;
  viewName: string;
  rawSearchText: string;
  compiledAst: AstClause[];
};

export type UpdateCustomModuleViewPayload = {
  id: string;
  viewName?: string;
  rawSearchText?: string;
  compiledAst?: AstClause[];
};

export type CustomModuleViewActionResult =
  | { ok: true; view?: CustomModuleView; views?: CustomModuleView[] }
  | { ok: false; error: string };
