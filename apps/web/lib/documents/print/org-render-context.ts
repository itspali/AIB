import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getTenantLogoSignedUrl } from "@/lib/organization/logo";
import type { DocumentOrgRenderContext } from "@/lib/documents/print/types";

function compactAddressLines(parts: Array<string | null | undefined>): string[] {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
}

export async function fetchDocumentOrgRenderContext(
  supabase: SupabaseClient,
  tenantId: string
): Promise<DocumentOrgRenderContext> {
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
