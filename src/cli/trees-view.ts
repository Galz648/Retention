import type { TreeListing } from "../domain/corpus.ts"

const row = (tree: TreeListing): string => `  ${tree.title}    ${tree.summary}`

const block = (
  heading: string,
  trees: ReadonlyArray<TreeListing>,
): ReadonlyArray<string> => {
  if (trees.length === 0) return []
  return [heading, ...trees.map(row), ""]
}

export const formatTreesList = (
  listings: ReadonlyArray<TreeListing>,
): string => {
  const live = listings.filter((tree) => !tree.archived)
  const knowledge = live.filter((tree) => tree.kind === "knowledge")
  const terms = live.filter((tree) => tree.kind === "terms")
  const archived = listings.filter((tree) => tree.archived)
  const lines = [
    ...block("Knowledge trees — concepts and what depends on what", knowledge),
    ...block("Term decks — names and conventions to recall", terms),
    ...block("Archived", archived),
  ]
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop()
  }
  return lines.join("\n")
}

export const selectLabels = (
  listings: ReadonlyArray<TreeListing>,
): ReadonlyArray<string> =>
  listings.map((tree) => `${tree.title} — ${tree.summary}`)
