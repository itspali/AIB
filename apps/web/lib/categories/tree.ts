import type { AttributeTemplateEntry, CategoryRow, CategoryTreeNode } from "@/lib/categories/types";

export function buildCategoryTree(rows: CategoryRow[]): CategoryTreeNode[] {
  const byId = new Map<string, CategoryTreeNode>();

  for (const row of rows) {
    byId.set(row.id, { ...row, children: [], depth: 0 });
  }

  const roots: CategoryTreeNode[] = [];

  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const assignDepth = (nodes: CategoryTreeNode[], depth: number) => {
    for (const node of nodes) {
      node.depth = depth;
      node.children.sort((a, b) => a.name.localeCompare(b.name));
      assignDepth(node.children, depth + 1);
    }
  };

  roots.sort((a, b) => a.name.localeCompare(b.name));
  assignDepth(roots, 0);
  return roots;
}

export function resolveLineage(categoryId: string, rows: CategoryRow[]): CategoryRow[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const lineage: CategoryRow[] = [];
  let current = byId.get(categoryId);

  while (current) {
    lineage.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }

  return lineage;
}

export function flattenTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  const flat: CategoryTreeNode[] = [];
  const walk = (list: CategoryTreeNode[]) => {
    for (const node of list) {
      flat.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return flat;
}

export function filterCategoryTree(
  nodes: CategoryTreeNode[],
  query: string
): CategoryTreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  const filterNode = (node: CategoryTreeNode): CategoryTreeNode | null => {
    const filteredChildren = node.children
      .map(filterNode)
      .filter((n): n is CategoryTreeNode => n !== null);

    const selfMatch = node.name.toLowerCase().includes(q);
    if (selfMatch || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    return null;
  };

  return nodes.map(filterNode).filter((n): n is CategoryTreeNode => n !== null);
}

export function parseAttributeTemplates(raw: unknown): AttributeTemplateEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      key: String(entry.key ?? ""),
      label: String(entry.label ?? entry.key ?? ""),
      type: (["text", "number", "date", "boolean"].includes(String(entry.type))
        ? String(entry.type)
        : "text") as AttributeTemplateEntry["type"],
      required: Boolean(entry.required),
    }))
    .filter((entry) => entry.key.trim().length > 0);
}

export function parentSelectOptions(
  rows: CategoryRow[]
): { id: string | null; label: string; depth: number }[] {
  const tree = buildCategoryTree(rows);
  const flat = flattenTree(tree);
  const options: { id: string | null; label: string; depth: number }[] = [
    { id: null, label: "Root level (no parent)", depth: 0 },
  ];

  for (const node of flat) {
    options.push({
      id: node.id,
      label: node.name,
      depth: node.depth,
    });
  }

  return options;
}
