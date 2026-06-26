import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  FileOutput,
  FileText,
  LayoutTemplate,
  MapPin,
  Network,
  Package,
  Receipt,
  Ruler,
  Shield,
  ShoppingCart,
  Truck,
} from "lucide-react";
import type { NavigationIndexEntry } from "@/lib/search/types";

/** Canonical settings paths — use for links, revalidatePath, and deep links. */
export const SETTINGS_ROUTES = {
  hub: "/settings",
  company: "/settings/company",
  enterprise: "/settings/enterprise",
  workspaceLocations: "/settings/workspace/locations",
  workspaceLocationsTopology: "/settings/workspace/locations/topology",
  access: "/settings/access",
  catalogsUom: "/settings/catalogs/uom",
  catalogsTax: "/settings/catalogs/tax",
  catalogsTaxGstr: "/settings/catalogs/tax/gstr",
  operations: "/settings/operations",
  operationsProcurement: "/settings/operations/procurement",
  operationsSales: "/settings/operations/sales",
  presentationDocuments: "/settings/presentation/documents",
  presentationNotifications: "/settings/presentation/notifications",
  account: "/account",
} as const;

export type SettingsRouteKey = keyof typeof SETTINGS_ROUTES;

export type SettingsCapabilityGate = "enterprise" | "importLogistics";

export type SettingsNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  keywords: string[];
  comingSoon?: boolean;
  capabilityGate?: SettingsCapabilityGate;
};

export type SettingsNavGroup = {
  id: string;
  label: string;
  items: SettingsNavItem[];
};

export type SettingsHubCard = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  comingSoon?: boolean;
  capabilityGate?: SettingsCapabilityGate;
};

export type SettingsHubSection = {
  id: string;
  label: string;
  cards: SettingsHubCard[];
};

export type SettingsNavCapabilities = {
  enterpriseEnabled?: boolean;
  importLogisticsEnabled?: boolean;
};

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        href: SETTINGS_ROUTES.company,
        label: "Company",
        icon: Building2,
        keywords: ["company", "organization", "tenant", "workspace", "profile", "billing", "branding"],
      },
      {
        href: SETTINGS_ROUTES.workspaceLocations,
        label: "Locations",
        icon: MapPin,
        keywords: ["locations", "warehouses", "stores", "topology", "numbering"],
      },
      {
        href: SETTINGS_ROUTES.access,
        label: "Access & roles",
        icon: Shield,
        keywords: ["users", "roles", "team", "members", "access", "rbac", "delegation"],
        comingSoon: true,
      },
    ],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    items: [
      {
        href: SETTINGS_ROUTES.enterprise,
        label: "Enterprise",
        icon: Network,
        keywords: ["group", "enterprise", "holding", "subsidiary", "multi-org"],
        capabilityGate: "enterprise",
      },
    ],
  },
  {
    id: "catalogs",
    label: "Catalogs",
    items: [
      {
        href: SETTINGS_ROUTES.catalogsTax,
        label: "Tax",
        icon: Receipt,
        keywords: ["tax", "gst", "vat", "tax rule", "tax code", "slab", "rate", "gstr"],
      },
      {
        href: SETTINGS_ROUTES.catalogsUom,
        label: "Units of measure",
        icon: Ruler,
        keywords: ["uom", "units", "measure", "measurement", "conversion"],
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        href: SETTINGS_ROUTES.operations,
        label: "Module settings",
        icon: LayoutTemplate,
        keywords: ["module", "procurement settings", "sales settings", "policies", "approvals"],
      },
    ],
  },
  {
    id: "presentation",
    label: "Presentation",
    items: [
      {
        href: SETTINGS_ROUTES.presentationDocuments,
        label: "Document templates",
        icon: FileOutput,
        keywords: ["print", "pdf", "document template", "letterhead", "appearance", "presentation"],
      },
      {
        href: SETTINGS_ROUTES.presentationNotifications,
        label: "Notification templates",
        icon: Bell,
        keywords: ["notifications", "email", "sms", "whatsapp", "templates"],
      },
    ],
  },
];

export const SETTINGS_HUB_SECTIONS: SettingsHubSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    cards: [
      {
        href: SETTINGS_ROUTES.company,
        label: "Company",
        description: "Legal identity, billing, branding, accounting defaults, and entity fields.",
        icon: Building2,
      },
      {
        href: SETTINGS_ROUTES.workspaceLocations,
        label: "Locations",
        description: "Warehouses, stores, document numbering, and location governance.",
        icon: MapPin,
      },
      {
        href: SETTINGS_ROUTES.access,
        label: "Access & roles",
        description: "Team members, roles, delegates, and field access policies.",
        icon: Shield,
        comingSoon: true,
      },
    ],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    cards: [
      {
        href: SETTINGS_ROUTES.enterprise,
        label: "Enterprise",
        description: "Enterprise group profile, subsidiary organizations, and workspace membership.",
        icon: Network,
        capabilityGate: "enterprise",
      },
    ],
  },
  {
    id: "catalogs",
    label: "Catalogs",
    cards: [
      {
        href: SETTINGS_ROUTES.catalogsTax,
        label: "Tax",
        description: "Tax components, rates, and filing configuration.",
        icon: Receipt,
      },
      {
        href: SETTINGS_ROUTES.catalogsUom,
        label: "Units of measure",
        description: "Base units, conversions, and catalog measurement standards.",
        icon: Ruler,
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    cards: [
      {
        href: SETTINGS_ROUTES.operations,
        label: "Module settings",
        description: "Module policies, approvals, and operational preferences by module.",
        icon: LayoutTemplate,
      },
    ],
  },
  {
    id: "presentation",
    label: "Presentation",
    cards: [
      {
        href: SETTINGS_ROUTES.presentationDocuments,
        label: "Document templates",
        description: "Letterhead, PDF appearance, and print layout shells for all modules.",
        icon: FileOutput,
      },
      {
        href: SETTINGS_ROUTES.presentationNotifications,
        label: "Notification templates",
        description: "Email, SMS, and WhatsApp templates for approval and credit-hold events.",
        icon: Bell,
      },
    ],
  },
];

export const OPERATIONS_HUB_CARDS: SettingsHubCard[] = [
  {
    href: SETTINGS_ROUTES.operationsProcurement,
    label: "Procurement",
    description: "Purchase order policies, approvals, and financial account defaults.",
    icon: ShoppingCart,
  },
  {
    href: `${SETTINGS_ROUTES.operations}/inventory`,
    label: "Inventory",
    description: "Stock adjustments, transfers, and inventory document layouts.",
    icon: Package,
    comingSoon: true,
  },
  {
    href: SETTINGS_ROUTES.operationsSales,
    label: "Sales",
    description: "Quotation, order, and invoice policies and approval rules.",
    icon: FileText,
  },
  {
    href: `${SETTINGS_ROUTES.operations}/logistics`,
    label: "Fulfillment",
    description: "Shipment documents and fulfillment presentation.",
    icon: Truck,
    comingSoon: true,
  },
];

function passesCapabilityGate(
  gate: SettingsCapabilityGate | undefined,
  capabilities: SettingsNavCapabilities
): boolean {
  if (!gate) return true;
  if (gate === "enterprise") return capabilities.enterpriseEnabled !== false;
  if (gate === "importLogistics") return capabilities.importLogisticsEnabled === true;
  return true;
}

export function filterSettingsNavItem<T extends { capabilityGate?: SettingsCapabilityGate }>(
  item: T,
  capabilities: SettingsNavCapabilities
): boolean {
  return passesCapabilityGate(item.capabilityGate, capabilities);
}

export function filterSettingsNavGroups(
  capabilities: SettingsNavCapabilities = {}
): SettingsNavGroup[] {
  return SETTINGS_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => filterSettingsNavItem(item, capabilities)),
  })).filter((group) => group.items.length > 0);
}

export type SettingsSidebarChild = {
  href: string;
  label: string;
  icon: LucideIcon;
  comingSoon?: boolean;
};

export function flattenSettingsNavChildren(
  capabilities: SettingsNavCapabilities = {}
): SettingsSidebarChild[] {
  return filterSettingsNavGroups(capabilities).flatMap((group) =>
    group.items.map((item) => ({
      href: item.href,
      label: item.label,
      icon: item.icon,
      comingSoon: item.comingSoon,
    }))
  );
}

export function filterSettingsHubSections(
  capabilities: SettingsNavCapabilities = {}
): SettingsHubSection[] {
  return SETTINGS_HUB_SECTIONS.map((section) => ({
    ...section,
    cards: section.cards.filter((card) => filterSettingsNavItem(card, capabilities)),
  })).filter((section) => section.cards.length > 0);
}

/** Omnibar / global search entries derived from settings navigation. */
export function buildSettingsNavigationIndex(): NavigationIndexEntry[] {
  const entries: NavigationIndexEntry[] = [
    {
      label: "Administration",
      href: SETTINGS_ROUTES.company,
      keywords: ["administration", "admin", "settings", "configuration", "setup"],
    },
    {
      label: "Company settings",
      href: SETTINGS_ROUTES.company,
      keywords: ["company", "organization", "tenant", "workspace"],
    },
    {
      label: "Enterprise settings",
      href: SETTINGS_ROUTES.enterprise,
      keywords: ["group", "enterprise", "holding", "subsidiary", "multi-org"],
    },
    {
      label: "Locations",
      href: SETTINGS_ROUTES.workspaceLocations,
      keywords: ["locations", "warehouses", "facilities", "inventory"],
    },
    {
      label: "Location topology",
      href: SETTINGS_ROUTES.workspaceLocationsTopology,
      keywords: ["topology", "hierarchy", "locations tree"],
    },
    {
      label: "Access & roles",
      href: SETTINGS_ROUTES.access,
      keywords: ["users", "roles", "team", "members", "access", "rbac", "delegation"],
    },
    {
      label: "Units of measure",
      href: SETTINGS_ROUTES.catalogsUom,
      keywords: ["uom", "units", "measure", "measurement", "conversion", "factor"],
    },
    {
      label: "Tax settings",
      href: SETTINGS_ROUTES.catalogsTax,
      keywords: ["tax", "gst", "vat", "tax rule", "tax code", "slab", "rate"],
    },
    {
      label: "GSTR export",
      href: SETTINGS_ROUTES.catalogsTaxGstr,
      keywords: ["gstr", "gst filing", "gstr-1", "gstr-2", "gstr-3b"],
    },
    {
      label: "Module settings",
      href: SETTINGS_ROUTES.operations,
      keywords: ["module", "procurement settings", "sales settings", "policies", "approvals"],
    },
    {
      label: "Procurement policies",
      href: SETTINGS_ROUTES.operationsProcurement,
      keywords: ["procurement", "purchase order", "policies", "approvals", "grn", "matching"],
    },
    {
      label: "Sales policies",
      href: SETTINGS_ROUTES.operationsSales,
      keywords: ["sales", "quotation", "quote", "sales order", "invoice", "policies", "approvals"],
    },
    {
      label: "Document templates",
      href: SETTINGS_ROUTES.presentationDocuments,
      keywords: ["print", "pdf", "document template", "letterhead", "appearance", "presentation"],
    },
    {
      label: "Notification templates",
      href: SETTINGS_ROUTES.presentationNotifications,
      keywords: ["notifications", "email", "sms", "whatsapp", "templates"],
    },
    {
      label: "My account",
      href: SETTINGS_ROUTES.account,
      keywords: ["profile", "account", "user", "password", "sessions"],
    },
  ];

  return entries;
}

/** Legacy path → canonical path (mirrors next.config.ts redirects). */
export const SETTINGS_LEGACY_REDIRECTS: { source: string; destination: string }[] = [
  { source: "/settings/organization", destination: SETTINGS_ROUTES.company },
  { source: "/settings/group", destination: SETTINGS_ROUTES.enterprise },
  { source: "/settings/locations", destination: SETTINGS_ROUTES.workspaceLocations },
  {
    source: "/settings/locations/topology",
    destination: SETTINGS_ROUTES.workspaceLocationsTopology,
  },
  { source: "/settings/users", destination: SETTINGS_ROUTES.access },
  { source: "/settings/uom", destination: SETTINGS_ROUTES.catalogsUom },
  { source: "/settings/tax", destination: SETTINGS_ROUTES.catalogsTax },
  { source: "/settings/tax/gstr", destination: SETTINGS_ROUTES.catalogsTaxGstr },
  { source: "/settings/modules", destination: SETTINGS_ROUTES.operations },
  {
    source: "/settings/modules/procurement",
    destination: SETTINGS_ROUTES.operationsProcurement,
  },
  { source: "/settings/modules/sales", destination: SETTINGS_ROUTES.operationsSales },
  {
    source: "/settings/documents/templates",
    destination: SETTINGS_ROUTES.presentationDocuments,
  },
  {
    source: "/settings/notifications",
    destination: SETTINGS_ROUTES.presentationNotifications,
  },
  { source: "/settings/profile", destination: SETTINGS_ROUTES.account },
];
