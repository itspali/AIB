import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getTenantLogoSignedUrl } from "@/lib/organization/logo";
import type { DocumentOrgRenderContext } from "@/lib/documents/print/types";

function compactAddressLines(parts: Array<string | null | undefined>): string[] {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
}

type FetchOrgRenderContextOptions = {
  locationId?: string | null;
};

async function fetchTenantOrgBase(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{
  organizationName: string;
  legalName: string | null;
  tradeName: string | null;
  taxIdentifier: string | null;
  addressLines: string[];
  logoUrl: string | null;
  websiteUrl: string | null;
  locale: string;
}> {
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select(
      "name, legal_name, trade_name, tax_identifier, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_zip_postal, billing_country_code, website_url, logo_url, locale"
    )
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const logoUrl = await getTenantLogoSignedUrl(supabase, tenant?.logo_url ?? null);

  const cityStateZip = compactAddressLines([
    tenant?.billing_city,
    tenant?.billing_state,
    tenant?.billing_zip_postal,
  ]).join(", ");

  const addressLines = compactAddressLines([
    tenant?.billing_address_line1,
    tenant?.billing_address_line2,
    cityStateZip || null,
    tenant?.billing_country_code,
  ]);

  return {
    organizationName: tenant?.name?.trim() || "Organization",
    legalName: tenant?.legal_name?.trim() || null,
    tradeName: tenant?.trade_name?.trim() || null,
    taxIdentifier: tenant?.tax_identifier?.trim() || null,
    addressLines,
    logoUrl,
    websiteUrl: tenant?.website_url?.trim() || null,
    locale: tenant?.locale?.trim() || "en-US",
  };
}

export async function fetchDocumentOrgRenderContext(
  supabase: SupabaseClient,
  tenantId: string,
  options?: FetchOrgRenderContextOptions
): Promise<DocumentOrgRenderContext> {
  const base = await fetchTenantOrgBase(supabase, tenantId);
  const locationId = options?.locationId?.trim() || null;
  if (!locationId) return base;

  const { data: location, error } = await supabase
    .from("tenant_locations")
    .select(
      "name, tax_registered_name, location_tax_identifier, address_line1, address_line2, city, state, zip_postal, country_code"
    )
    .eq("tenant_id", tenantId)
    .eq("id", locationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!location) return base;

  const cityStateZip = compactAddressLines([location.city, location.state, location.zip_postal]).join(
    ", "
  );

  const locationAddressLines = compactAddressLines([
    location.address_line1,
    location.address_line2,
    cityStateZip || null,
    location.country_code,
  ]);

  const registeredName = location.tax_registered_name?.trim() || location.name?.trim() || null;

  return {
    ...base,
    legalName: registeredName ?? base.legalName,
    taxIdentifier: location.location_tax_identifier?.trim() || base.taxIdentifier,
    addressLines: locationAddressLines.length > 0 ? locationAddressLines : base.addressLines,
  };
}
