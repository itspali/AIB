import type { LocationFormValues, PresenceEnvironment } from "@/lib/locations/types";

export type LocationCodeSuggestion = {
  code: string;
  scope: string;
  role: string;
  sequence: number;
  role_key: string;
};

export type LocationCodeSuggestInput = {
  presence_type: PresenceEnvironment;
  is_administrative_office: boolean;
  is_commercial_storefront: boolean;
  is_manufacturing_floor: boolean;
  is_stock_holding: boolean;
  parent_location_id: string | null;
  country_code: string;
  city: string;
  location_id: string | null;
};

export function buildLocationCodeSuggestInput(
  form: Pick<
    LocationFormValues,
    | "presence_type"
    | "is_administrative_office"
    | "is_commercial_storefront"
    | "is_manufacturing_floor"
    | "is_stock_holding"
    | "parent_location_id"
    | "country_code"
    | "city"
    | "location_id"
  >
): LocationCodeSuggestInput {
  return {
    presence_type: form.presence_type,
    is_administrative_office: form.is_administrative_office,
    is_commercial_storefront: form.is_commercial_storefront,
    is_manufacturing_floor: form.is_manufacturing_floor,
    is_stock_holding: form.is_stock_holding,
    parent_location_id: form.parent_location_id,
    country_code: form.country_code,
    city: form.city,
    location_id: form.location_id,
  };
}

export function buildCodeGenerationMeta(
  suggestion: LocationCodeSuggestion,
  manuallyEdited: boolean
): Record<string, unknown> {
  return {
    code_generation: {
      scope: suggestion.scope,
      role: suggestion.role,
      sequence: suggestion.sequence,
      role_key: suggestion.role_key,
      suggested_code: suggestion.code,
      manually_edited: manuallyEdited,
      generated_at: new Date().toISOString(),
    },
  };
}
