import type { LocationTopologyRow, LocationTreeNode } from "@/lib/locations/types";

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
