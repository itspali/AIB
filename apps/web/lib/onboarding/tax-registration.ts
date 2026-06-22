export type TaxRegistrationStatus = "REGISTERED" | "NOT_REGISTERED" | "EXEMPT";

export const TAX_REGISTRATION_STATUS_OPTIONS: {
  value: TaxRegistrationStatus;
  label: string;
  description: string;
}[] = [
  {
    value: "REGISTERED",
    label: "Registered for tax",
    description: "You have a GSTIN, VAT number, EIN, or equivalent tax ID",
  },
  {
    value: "NOT_REGISTERED",
    label: "Not registered yet",
    description: "You can add tax details later before issuing tax invoices",
  },
  {
    value: "EXEMPT",
    label: "Tax exempt",
    description: "Your business is exempt from sales or GST/VAT registration",
  },
];

export function inferTaxRegistrationStatus(taxIdentifier: string | null | undefined): TaxRegistrationStatus {
  if (taxIdentifier?.trim()) return "REGISTERED";
  return "NOT_REGISTERED";
}

export function taxIdLabelForCountry(countryCode: string): string {
  switch (countryCode.toUpperCase()) {
    case "IN":
      return "GSTIN";
    case "GB":
      return "VAT number";
    case "US":
      return "EIN / Tax ID";
    default:
      return "Tax ID (GSTIN / VAT / EIN)";
  }
}

export function registrationLabelForCountry(countryCode: string): string {
  switch (countryCode.toUpperCase()) {
    case "IN":
      return "CIN / business registration number";
    default:
      return "Business registration number";
  }
}
