import type { TreeListing } from "../domain/corpus.ts"

export const matchTitle = (
  listings: ReadonlyArray<TreeListing>,
  query: string,
): ReadonlyArray<TreeListing> => {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return []
  const exact = listings.filter((tree) => tree.title.toLowerCase() === needle)
  if (exact.length > 0) return exact
  return listings.filter((tree) => tree.title.toLowerCase().startsWith(needle))
}

export const pickByNumber = (
  listings: ReadonlyArray<TreeListing>,
  raw: string,
): TreeListing | undefined => {
  if (!/^\d+$/.test(raw.trim())) return undefined
  const index = Number(raw.trim())
  if (index < 1 || index > listings.length) return undefined
  return listings[index - 1]
}
