import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Calculator,
  Globe2,
  Network,
  Palette,
  ShieldCheck,
  Wallet,
} from "lucide-react";

export const ORG_SETTINGS_TAB_IDS = {
  identity: "identity",
  regional: "regional",
  billingFiscal: "billing-fiscal",
  branding: "branding",
  locations: "locations",
  accounting: "accounting",
  access: "access",
} as const;

export type OrgSettingsTabId = (typeof ORG_SETTINGS_TAB_IDS)[keyof typeof ORG_SETTINGS_TAB_IDS];

export const ORG_SETTINGS_SECTION_ELEMENT_IDS: Record<OrgSettingsTabId, string> = {
  [ORG_SETTINGS_TAB_IDS.identity]: "org-section-identity",
  [ORG_SETTINGS_TAB_IDS.regional]: "org-section-regional",
  [ORG_SETTINGS_TAB_IDS.billingFiscal]: "org-section-billing-fiscal",
  [ORG_SETTINGS_TAB_IDS.branding]: "org-section-branding",
  [ORG_SETTINGS_TAB_IDS.locations]: "org-section-locations",
  [ORG_SETTINGS_TAB_IDS.accounting]: "org-section-accounting",
  [ORG_SETTINGS_TAB_IDS.access]: "org-section-access",
};

export type OrgSettingsTabItem = {
  id: OrgSettingsTabId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

export const ORG_SETTINGS_TABS: OrgSettingsTabItem[] = [
  {
    id: ORG_SETTINGS_TAB_IDS.identity,
    label: "Identity",
    shortLabel: "Identity",
    icon: Building2,
  },
  {
    id: ORG_SETTINGS_TAB_IDS.regional,
    label: "Regional",
    shortLabel: "Regional",
    icon: Globe2,
  },
  {
    id: ORG_SETTINGS_TAB_IDS.billingFiscal,
    label: "Billing & Fiscal",
    shortLabel: "Billing",
    icon: Wallet,
  },
  {
    id: ORG_SETTINGS_TAB_IDS.branding,
    label: "Branding",
    shortLabel: "Brand",
    icon: Palette,
  },
  {
    id: ORG_SETTINGS_TAB_IDS.locations,
    label: "Locations",
    shortLabel: "Locations",
    icon: Network,
  },
  {
    id: ORG_SETTINGS_TAB_IDS.accounting,
    label: "Accounting",
    shortLabel: "Accounting",
    icon: Calculator,
  },
  {
    id: ORG_SETTINGS_TAB_IDS.access,
    label: "Access",
    shortLabel: "Access",
    icon: ShieldCheck,
  },
];

/** @deprecated Use ORG_SETTINGS_TAB_IDS — kept for any lingering scroll-spy references */
export const ORG_SETTINGS_SECTION_IDS = {
  identity: "org-section-identity",
  localization: "org-section-localization",
  billing: "org-section-billing",
  fiscal: "org-section-fiscal",
  brand: "org-section-brand",
  location: "org-section-location",
  naming: "org-section-naming",
  accounting: "org-section-accounting",
} as const;
