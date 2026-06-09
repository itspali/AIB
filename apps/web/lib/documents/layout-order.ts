/** Merge saved column order with registry ids (append new ids at end). */
export function mergeFieldOrder<TId extends string>(
  savedOrder: readonly TId[] | undefined,
  registryIds: readonly TId[]
): TId[] {
  const registrySet = new Set(registryIds);
  const merged: TId[] = [];

  for (const id of savedOrder ?? []) {
    if (registrySet.has(id) && !merged.includes(id)) merged.push(id);
  }

  for (const id of registryIds) {
    if (!merged.includes(id)) merged.push(id);
  }

  return merged;
}

export function moveFieldInOrder<TId extends string>(
  order: readonly TId[],
  fromId: TId,
  toId: TId,
  options?: { pinnedIds?: readonly TId[] }
): TId[] {
  if (fromId === toId) return [...order];

  const pinned = new Set(options?.pinnedIds ?? []);
  if (pinned.has(fromId) || pinned.has(toId)) return [...order];

  const next = order.filter((id) => id !== fromId);
  const targetIndex = next.indexOf(toId);
  if (targetIndex === -1) return [...order];

  next.splice(targetIndex, 0, fromId);
  return next;
}

export function orderedColumnPrefs<TId extends string>(
  order: readonly TId[],
  columns: readonly { id: string }[],
  getPref: (id: TId) => { id: string } | undefined
): { id: string }[] {
  const result: { id: string }[] = [];

  for (const id of order) {
    const pref = getPref(id);
    if (pref) result.push(pref);
  }

  for (const column of columns) {
    if (!order.includes(column.id as TId) && !result.some((entry) => entry.id === column.id)) {
      result.push(column);
    }
  }

  return result;
}
