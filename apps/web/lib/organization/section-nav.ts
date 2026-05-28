export const ORG_SETTINGS_SECTION_IDS = {
  identity: "org-section-identity",
  billing: "org-section-billing",
  fiscal: "org-section-fiscal",
  brand: "org-section-brand",
  location: "org-section-location",
  naming: "org-section-naming",
  accounting: "org-section-accounting",
} as const;

export type OrgSettingsSectionId =
  (typeof ORG_SETTINGS_SECTION_IDS)[keyof typeof ORG_SETTINGS_SECTION_IDS];

export type OrgSettingsSectionNavItem = {
  id: OrgSettingsSectionId;
  label: string;
  shortLabel?: string;
  advanced?: boolean;
};

export const ORG_SETTINGS_SECTIONS: OrgSettingsSectionNavItem[] = [
  {
    id: ORG_SETTINGS_SECTION_IDS.identity,
    label: "Legal & Contact Identity",
    shortLabel: "Identity",
  },
  { id: ORG_SETTINGS_SECTION_IDS.billing, label: "Billing Address", shortLabel: "Billing" },
  {
    id: ORG_SETTINGS_SECTION_IDS.fiscal,
    label: "Fiscal Engine Rules",
    shortLabel: "Fiscal",
  },
  {
    id: ORG_SETTINGS_SECTION_IDS.brand,
    label: "Brand & Web",
    shortLabel: "Brand",
    advanced: true,
  },
  {
    id: ORG_SETTINGS_SECTION_IDS.location,
    label: "Location Governance",
    shortLabel: "Locations",
    advanced: true,
  },
  {
    id: ORG_SETTINGS_SECTION_IDS.naming,
    label: "Document Naming",
    shortLabel: "Naming",
    advanced: true,
  },
  {
    id: ORG_SETTINGS_SECTION_IDS.accounting,
    label: "Accounting & Controls",
    shortLabel: "Accounting",
    advanced: true,
  },
];
