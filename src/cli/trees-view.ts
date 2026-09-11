import type { Track, TreeListing } from "../domain/corpus.ts"
import type { Palette } from "./style.ts"

const TITLE_CAP = 42
const TITLE_GAP = "  "
const BRANCH_MID = "  ├─ "
const BRANCH_END = "  └─ "
const INDENT = "  "

export const TRACK_ORDER: ReadonlyArray<Track> = ["university", "curiosity"]

export const TRACK_HEADING: Record<Track, string> = {
  university: "University — course work",
  curiosity: "Curiosity — personal research",
}

export const TRACK_MENU: Record<Track, string> = {
  university: "University    course work",
  curiosity: "Curiosity     personal research",
}

const live = (listings: ReadonlyArray<TreeListing>): ReadonlyArray<TreeListing> =>
  listings.filter((tree) => !tree.archived)

const knownIds = (listings: ReadonlyArray<TreeListing>): Set<string> =>
  new Set(listings.map((tree) => tree.treeId))

export const onTrack = (
  listings: ReadonlyArray<TreeListing>,
  track: Track,
): ReadonlyArray<TreeListing> => listings.filter((tree) => tree.track === track)

export const presentTracks = (
  listings: ReadonlyArray<TreeListing>,
): ReadonlyArray<Track> =>
  TRACK_ORDER.filter((track) => live(listings).some((tree) => tree.track === track))

export const attachedDecks = (
  listings: ReadonlyArray<TreeListing>,
  parent: TreeListing,
): ReadonlyArray<TreeListing> =>
  live(listings)
    .filter(
      (tree) => tree.kind === "terms" && tree.belongsTo === parent.treeId,
    )
    .slice()
    .sort((left, right) => left.title.localeCompare(right.title))

export const unattachedDecks = (
  listings: ReadonlyArray<TreeListing>,
): ReadonlyArray<TreeListing> => {
  const ids = knownIds(listings)
  return live(listings)
    .filter((tree) => {
      if (tree.kind !== "terms") return false
      if (tree.belongsTo === undefined) return true
      return !ids.has(tree.belongsTo)
    })
    .slice()
    .sort((left, right) => left.title.localeCompare(right.title))
}

export const knowledgeTrees = (
  listings: ReadonlyArray<TreeListing>,
): ReadonlyArray<TreeListing> =>
  live(listings)
    .filter((tree) => tree.kind === "knowledge")
    .slice()
    .sort((left, right) => left.title.localeCompare(right.title))

const paintTitle = (tree: TreeListing, ink: Palette | undefined): string => {
  if (ink === undefined) return tree.title
  return tree.kind === "knowledge" ? ink.knowledge(tree.title) : ink.terms(tree.title)
}

const paintHeading = (text: string, ink: Palette | undefined): string =>
  ink === undefined ? text : ink.dim(text)

const archivedTrees = (
  listings: ReadonlyArray<TreeListing>,
): ReadonlyArray<TreeListing> =>
  listings
    .filter((tree) => tree.archived)
    .slice()
    .sort((left, right) => left.title.localeCompare(right.title))

type VisibleRow = {
  readonly prefix: string
  readonly tree: TreeListing
}

const visibleRows = (listings: ReadonlyArray<TreeListing>): ReadonlyArray<VisibleRow> => {
  const rows: Array<VisibleRow> = []
  for (const tree of knowledgeTrees(listings)) {
    rows.push({ prefix: INDENT, tree })
    const decks = attachedDecks(listings, tree)
    for (const [index, deck] of decks.entries()) {
      rows.push({
        prefix: index === decks.length - 1 ? BRANCH_END : BRANCH_MID,
        tree: deck,
      })
    }
  }
  for (const tree of unattachedDecks(listings)) {
    rows.push({ prefix: INDENT, tree })
  }
  for (const tree of archivedTrees(listings)) {
    rows.push({ prefix: INDENT, tree })
  }
  return rows
}

const titleColumn = (rows: ReadonlyArray<VisibleRow>): number =>
  Math.min(
    TITLE_CAP,
    rows.reduce((width, row) => Math.max(width, row.tree.title.length), 0),
  )

const leftColumn = (rows: ReadonlyArray<VisibleRow>, titleCol: number): number =>
  rows.reduce((width, row) => Math.max(width, row.prefix.length + titleCol), 0)

const formatRow = (
  prefix: string,
  tree: TreeListing,
  leftCol: number,
  ink: Palette | undefined,
): string => {
  const pad = Math.max(0, leftCol - prefix.length - tree.title.length)
  return `${prefix}${paintTitle(tree, ink)}${" ".repeat(pad)}${TITLE_GAP}${tree.summary}`
}

const formatKindGroups = (
  listings: ReadonlyArray<TreeListing>,
  leftCol: number,
  ink: Palette | undefined,
): Array<string> => {
  const knowledge = knowledgeTrees(listings)
  const loose = unattachedDecks(listings)
  const lines: Array<string> = []
  if (knowledge.length > 0) {
    lines.push(paintHeading("Knowledge trees — concepts and what depends on what", ink))
    for (const tree of knowledge) {
      lines.push(formatRow(INDENT, tree, leftCol, ink))
      const decks = attachedDecks(listings, tree)
      for (const [index, deck] of decks.entries()) {
        const prefix = index === decks.length - 1 ? BRANCH_END : BRANCH_MID
        lines.push(formatRow(prefix, deck, leftCol, ink))
      }
    }
    lines.push("")
  }
  if (loose.length > 0) {
    lines.push(paintHeading("Term decks — not attached to a knowledge tree", ink))
    for (const tree of loose) {
      lines.push(formatRow(INDENT, tree, leftCol, ink))
    }
    lines.push("")
  }
  return lines
}

export const formatTreesList = (
  listings: ReadonlyArray<TreeListing>,
  ink?: Palette,
): string => {
  const archived = archivedTrees(listings)
  const rows = visibleRows(listings)
  const leftCol = leftColumn(rows, titleColumn(rows))
  const lines: Array<string> = []
  for (const track of TRACK_ORDER) {
    const subset = onTrack(listings, track)
    if (knowledgeTrees(subset).length === 0 && unattachedDecks(subset).length === 0) {
      continue
    }
    lines.push(paintHeading(TRACK_HEADING[track], ink))
    lines.push("")
    lines.push(...formatKindGroups(subset, leftCol, ink))
  }
  if (archived.length > 0) {
    lines.push(paintHeading("Archived", ink))
    for (const tree of archived) {
      lines.push(formatRow(INDENT, tree, leftCol, ink))
    }
    lines.push("")
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop()
  }
  return lines.join("\n")
}

export const selectLabels = (
  listings: ReadonlyArray<TreeListing>,
): ReadonlyArray<string> =>
  listings.map((tree) => `${tree.title} — ${tree.summary}`)
