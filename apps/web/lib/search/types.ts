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
  | "ILIKE";

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
};

export type FieldSensitivity = "standard" | "financial";

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
  | { ok: false; error: string; field?: string };

export type NavigationIndexEntry = {
  label: string;
  href: string;
  keywords: string[];
};
