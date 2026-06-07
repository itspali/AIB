/** Invalidated when the items catalog unmounts so in-flight server actions can no-op. */
let itemsRouteGeneration = 0;

export function allocateItemsRouteSession(): number {
  itemsRouteGeneration += 1;
  return itemsRouteGeneration;
}

export function invalidateItemsRouteSessions(): void {
  itemsRouteGeneration += 1;
}

export function isItemsRouteSessionActive(sessionId: number): boolean {
  return sessionId === itemsRouteGeneration;
}
