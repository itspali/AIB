import type { LocationRow, LocationTopologyRow, LocationTreeNode } from "@/lib/locations/types";

export function buildLocationTreeFromRows(rows: LocationRow[]): LocationTreeNode[] {
  const mapped: LocationTopologyRow[] = rows.map((row) => ({
    id: row.id,
    parent_location_id: row.parent_location_id,
    name: row.name,
    code: row.code,
    presence_type: row.presence_type,
    is_administrative_office: row.is_administrative_office,
    is_commercial_storefront: row.is_commercial_storefront,
    is_manufacturing_floor: row.is_manufacturing_floor,
    is_stock_holding: row.is_stock_holding,
    pos_terminal_count: row.pos_terminal_count,
    is_active: row.is_active,
    address_line1: row.address_line1,
    address_line2: row.address_line2,
    city: row.city,
    state: row.state,
    zip_postal: row.zip_postal,
    country_code: row.country_code,
    manager_name: row.manager_name,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    depth: 0,
    path: [row.id],
    child_count: rows.filter((candidate) => candidate.parent_location_id === row.id).length,
  }));

  return buildLocationTopologyTree(mapped);
}

export function buildLocationTopologyTree(rows: LocationTopologyRow[]): LocationTreeNode[] {
  const byId = new Map<string, LocationTreeNode>();

  for (const row of rows) {
    byId.set(row.id, { ...row, children: [] });
  }

  const roots: LocationTreeNode[] = [];

  for (const node of byId.values()) {
    if (node.parent_location_id && byId.has(node.parent_location_id)) {
      byId.get(node.parent_location_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: LocationTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };

  sortNodes(roots);
  return roots;
}

export function filterLocationTopologyTree(
  nodes: LocationTreeNode[],
  query: string
): LocationTreeNode[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return nodes;

  const filterNode = (node: LocationTreeNode): LocationTreeNode | null => {
    const childMatches = node.children
      .map(filterNode)
      .filter((child): child is LocationTreeNode => child !== null);

    const selfMatches =
      node.name.toLowerCase().includes(normalized) ||
      node.code.toLowerCase().includes(normalized) ||
      node.presence_type.toLowerCase().includes(normalized);

    if (selfMatches || childMatches.length > 0) {
      return { ...node, children: childMatches };
    }

    return null;
  };

  return nodes.map(filterNode).filter((node): node is LocationTreeNode => node !== null);
}

export function collectDefaultExpandedIds(rows: LocationTopologyRow[]): Set<string> {
  const expanded = new Set<string>();
  for (const row of rows) {
    if (row.depth <= 1) expanded.add(row.id);
  }
  return expanded;
}
