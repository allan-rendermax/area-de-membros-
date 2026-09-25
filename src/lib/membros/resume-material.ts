// Visits are supplied in descending access order by the server-side history query.
export function resolveResumeItem(visits: readonly { itemId: string }[], accessibleItemIds: ReadonlySet<string>): string | null {
  return visits.find((visit) => accessibleItemIds.has(visit.itemId))?.itemId ?? null
}
