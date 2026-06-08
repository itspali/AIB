import {
  isDuplicateAttributeKey,
  normalizeAttributeKey,
  slugifyAttributeKey,
  suggestUniqueAttributeKey,
} from "@/lib/categories/attribute-key";
import type { EntityWorkspace } from "@/lib/entities/types";

export const ENTITY_CUSTOM_FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes / No" },
  { value: "date", label: "Date" },
  { value: "select", label: "Single select" },
] as const;

export type EntityCustomFieldType = (typeof ENTITY_CUSTOM_FIELD_TYPES)[number]["value"];

export type EntityCustomFieldDefinition = {
  key: string;
  label: string;
  type: EntityCustomFieldType;
  required?: boolean;
  options?: string[];
  help_text?: string;
  source?: "group" | "organization";
};

export type EntityCustomFieldSettings = {
  custom_field_definitions: EntityCustomFieldDefinition[];
};

export type EntitySettingsMetadata = {
  customer?: EntityCustomFieldSettings;
  supplier?: EntityCustomFieldSettings;
};

const ENTITY_SETTINGS_METADATA_KEY = "entity_settings";
const VALID_TYPES = new Set<string>(ENTITY_CUSTOM_FIELD_TYPES.map((entry) => entry.value));

export function entitySettingsWorkspaceKey(
  workspace: EntityWorkspace
): keyof EntitySettingsMetadata {
  return workspace === "customer" ? "customer" : "supplier";
}

export function parseEntityCustomFieldDefinitions(raw: unknown): EntityCustomFieldDefinition[] {
  if (!Array.isArray(raw)) return [];

  const parsed: EntityCustomFieldDefinition[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const key = typeof row.key === "string" ? normalizeAttributeKey(row.key) : "";
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const type = typeof row.type === "string" ? row.type : "text";

    if (!key || !label || !VALID_TYPES.has(type)) continue;

    const options = Array.isArray(row.options)
      ? row.options
          .map((option) => (typeof option === "string" ? option.trim() : ""))
          .filter(Boolean)
      : undefined;

    parsed.push({
      key,
      label,
      type: type as EntityCustomFieldType,
      required: row.required === true,
      options: type === "select" ? options ?? [] : undefined,
      help_text: typeof row.help_text === "string" ? row.help_text.trim() : undefined,
      source:
        row.source === "group" || row.source === "organization" ? row.source : undefined,
    });
  }

  return parsed;
}

export function parseEntitySettingsMetadata(raw: unknown): EntitySettingsMetadata {
  if (!raw || typeof raw !== "object") return {};
  const root = raw as Record<string, unknown>;
  const entitySettings =
    root[ENTITY_SETTINGS_METADATA_KEY] && typeof root[ENTITY_SETTINGS_METADATA_KEY] === "object"
      ? (root[ENTITY_SETTINGS_METADATA_KEY] as Record<string, unknown>)
      : root;

  const customerRaw =
    entitySettings.customer && typeof entitySettings.customer === "object"
      ? (entitySettings.customer as Record<string, unknown>).custom_field_definitions
      : undefined;
  const supplierRaw =
    entitySettings.supplier && typeof entitySettings.supplier === "object"
      ? (entitySettings.supplier as Record<string, unknown>).custom_field_definitions
      : undefined;

  return {
    customer: { custom_field_definitions: parseEntityCustomFieldDefinitions(customerRaw) },
    supplier: { custom_field_definitions: parseEntityCustomFieldDefinitions(supplierRaw) },
  };
}

export function mergeEntityCustomFieldDefinitions(
  groupDefinitions: EntityCustomFieldDefinition[],
  organizationDefinitions: EntityCustomFieldDefinition[]
): EntityCustomFieldDefinition[] {
  const merged = new Map<string, EntityCustomFieldDefinition>();

  for (const definition of groupDefinitions) {
    merged.set(normalizeAttributeKey(definition.key), {
      ...definition,
      source: "group",
    });
  }

  for (const definition of organizationDefinitions) {
    merged.set(normalizeAttributeKey(definition.key), {
      ...definition,
      source: "organization",
    });
  }

  return [...merged.values()];
}

export function resolveEntityCustomFieldDefinitions(
  entitySettings: EntitySettingsMetadata | null | undefined,
  groupEntitySettings: EntitySettingsMetadata | null | undefined,
  workspace: EntityWorkspace
): EntityCustomFieldDefinition[] {
  const workspaceKey = entitySettingsWorkspaceKey(workspace);
  const orgDefs = entitySettings?.[workspaceKey]?.custom_field_definitions ?? [];
  const groupDefs = groupEntitySettings?.[workspaceKey]?.custom_field_definitions ?? [];
  return mergeEntityCustomFieldDefinitions(groupDefs, orgDefs);
}

export function sanitizeEntityCustomFieldDefinitions(
  rows: EntityCustomFieldDefinition[]
): EntityCustomFieldDefinition[] {
  const sanitized: EntityCustomFieldDefinition[] = [];
  const usedKeys = new Set<string>();

  for (const row of rows) {
    const label = row.label.trim();
    if (!label) continue;

    let key = normalizeAttributeKey(row.key || slugifyAttributeKey(label));
    if (!key) key = slugifyAttributeKey(label);

    if (usedKeys.has(key)) {
      key = suggestUniqueAttributeKey(label, sanitized, sanitized.length);
    }
    usedKeys.add(key);

    const type = VALID_TYPES.has(row.type) ? row.type : "text";
    const options =
      type === "select"
        ? (row.options ?? [])
            .map((option) => option.trim())
            .filter(Boolean)
        : undefined;

    sanitized.push({
      key,
      label,
      type: type as EntityCustomFieldType,
      required: row.required === true,
      help_text: row.help_text?.trim() || undefined,
      options,
    });
  }

  return sanitized;
}

export function validateEntityCustomFieldDefinitions(
  rows: EntityCustomFieldDefinition[]
): string | null {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row.label.trim()) {
      return `Custom field ${index + 1} needs a label`;
    }
    if (!row.key.trim()) {
      return `Custom field "${row.label}" needs a key`;
    }
    if (isDuplicateAttributeKey(rows, index)) {
      return `Duplicate custom field key "${row.key}"`;
    }
    if (row.type === "select" && !(row.options?.length ?? 0)) {
      return `Custom field "${row.label}" needs at least one option`;
    }
  }
  return null;
}

export function buildEntitySettingsMetadataPatch(
  workspace: EntityWorkspace,
  definitions: EntityCustomFieldDefinition[]
): Record<string, unknown> {
  const workspaceKey = entitySettingsWorkspaceKey(workspace);
  return {
    [ENTITY_SETTINGS_METADATA_KEY]: {
      [workspaceKey]: {
        custom_field_definitions: sanitizeEntityCustomFieldDefinitions(definitions),
      },
    },
  };
}

export function entityCustomFieldTypeNeedsOptions(type: EntityCustomFieldType): boolean {
  return type === "select";
}

export function defaultEntityCustomFieldRow(): EntityCustomFieldDefinition {
  return {
    key: "",
    label: "",
    type: "text",
    required: false,
  };
}

export function validateEntityCustomFieldValues(
  definitions: EntityCustomFieldDefinition[],
  values: Record<string, string>
): string | null {
  for (const definition of definitions) {
    const value = values[definition.key]?.trim() ?? "";
    if (definition.required && !value) {
      return `${definition.label} is required`;
    }
    if (!value) continue;

    if (definition.type === "number" && Number.isNaN(Number(value))) {
      return `${definition.label} must be a number`;
    }
    if (definition.type === "select" && definition.options?.length) {
      if (!definition.options.includes(value)) {
        return `${definition.label} must be one of the configured options`;
      }
    }
  }
  return null;
}

export function syncEntityCustomFieldValues(
  definitions: EntityCustomFieldDefinition[],
  existing: Record<string, string>
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const definition of definitions) {
    next[definition.key] = existing[definition.key] ?? "";
  }
  return next;
}

export { slugifyAttributeKey, suggestUniqueAttributeKey };
