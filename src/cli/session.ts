import { Effect } from "effect"
import type { Card, Outcome } from "../domain/cards.ts"
import type { Corpus, TreeListing } from "../domain/corpus.ts"
import type { Node } from "../domain/corpus.ts"
import type { CardId, NodeId, TreeId } from "../domain/ids.ts"
import { SessionError } from "../session/interface.ts"
import { formatShow, nodeTitle } from "./cards-view.ts"
import { attachedDecks, knowledgeTrees, unattachedDecks } from "./trees-view.ts"
import type { Palette } from "./style.ts"
import {
  CLEAR,
  highlight,
  moveCursor,
  withAlternateScreen,
  withRawMode,
  type Key,
} from "./tui.ts"

type SessionIo = {
  readonly write: (line: string) => void
  readonly readKey: () => Effect.Effect<Key | undefined>
  readonly raw?: { readonly setRawMode?: (value: boolean) => void } | undefined
}

export type SessionOps<R> = {
  readonly version: string
  readonly logExists: boolean
  readonly queue: (
    treeId: TreeId,
  ) => Effect.Effect<ReadonlyArray<Card>, SessionError, R>
  readonly grade: (
    treeId: TreeId,
    cardId: CardId,
    rating: Outcome,
  ) => Effect.Effect<void, SessionError, R>
}

export type MenuItem =
  | { readonly _tag: "option"; readonly id: "session" | "trees" | "status" }
  | { readonly _tag: "tree"; readonly listing: TreeListing }
  | { readonly _tag: "node"; readonly listing: TreeListing; readonly node: Node }
  | { readonly _tag: "card"; readonly listing: TreeListing; readonly card: Card }

type Frame =
  | { readonly _tag: "home" }
  | { readonly _tag: "pick"; readonly purpose: "session" | "trees" }
  | { readonly _tag: "tree"; readonly listing: TreeListing }
  | { readonly _tag: "node"; readonly listing: TreeListing; readonly nodeId: NodeId }
  | {
      readonly _tag: "card"
      readonly listing: TreeListing
      readonly card: Card
      readonly fromQueue: boolean
    }
  | { readonly _tag: "queue"; readonly listing: TreeListing }
  | { readonly _tag: "rating"; readonly listing: TreeListing; readonly card: Card }
  | {
      readonly _tag: "consent"
      readonly listing: TreeListing
      readonly card: Card
      readonly rating: Outcome
    }
  | { readonly _tag: "status" }

export type SessionEntry =
  | { readonly _tag: "home" }
  | { readonly _tag: "trees" }
  | { readonly _tag: "session"; readonly listing: TreeListing }

const TITLE_CAP = 42
const TITLE_GAP = "  "
const BRANCH_MID = "  ├─ "
const BRANCH_END = "  └─ "
const RATINGS: ReadonlyArray<Outcome> = ["Again", "Hard", "Good", "Easy"]

const fail = (reason: string): Effect.Effect<never, SessionError> =>
  Effect.fail(new SessionError({ reason }))

export const graphRoots = (corpus: Corpus): ReadonlyArray<Node> => {
  const tos = new Set(corpus.edges.map((edge) => edge.to))
  const roots = corpus.nodes.filter((node) => !tos.has(node.id))
  return roots.length > 0 ? roots : corpus.nodes
}

export const graphChildren = (
  corpus: Corpus,
  nodeId: NodeId,
): ReadonlyArray<Node> => {
  const ids = corpus.edges.filter((edge) => edge.from === nodeId).map((edge) => edge.to)
  return ids.flatMap((id) => {
    const node = corpus.nodes.find((item) => item.id === id)
    return node === undefined ? [] : [node]
  })
}

export const nodeCards = (
  corpus: Corpus,
  nodeId: NodeId,
): ReadonlyArray<Card> => corpus.cards.filter((card) => card.nodeId === nodeId)

export const nodePath = (
  corpus: Corpus,
  nodeId: NodeId,
): ReadonlyArray<Node> => {
  const byId = new Map(corpus.nodes.map((node) => [node.id, node] as const))
  const seen = new Set<string>()
  const walk = (id: NodeId): ReadonlyArray<Node> => {
    if (seen.has(id)) return []
    seen.add(id)
    const node = byId.get(id)
    if (node === undefined) return []
    const parent = corpus.edges.find(
      (edge) => edge.to === id && byId.has(edge.from),
    )
    if (parent === undefined) return [node]
    return [...walk(parent.from), node]
  }
  return walk(nodeId)
}

export const locationLines = (
  corpus: Corpus,
  here?: NodeId,
): ReadonlyArray<string> => {
  if (here === undefined) {
    return [corpus.title, ...graphRoots(corpus).map((node) => `  ${node.title}`)]
  }
  const path = nodePath(corpus, here)
  const lines: Array<string> = [corpus.title]
  path.forEach((node, index) => {
    const mark = node.id === here ? "● " : "  "
    lines.push(`${"  ".repeat(index)}${mark}${node.title}`)
  })
  const kids = graphChildren(corpus, here)
  const depth = path.length
  for (const kid of kids) {
    lines.push(`${"  ".repeat(depth)}  ${kid.title}`)
  }
  return lines
}

export const rootItems = (
  listings: ReadonlyArray<TreeListing>,
): ReadonlyArray<MenuItem> => [
  ...knowledgeTrees(listings).map(
    (listing): MenuItem => ({ _tag: "tree", listing }),
  ),
  ...unattachedDecks(listings).map(
    (listing): MenuItem => ({ _tag: "tree", listing }),
  ),
]

export const treeItems = (
  listings: ReadonlyArray<TreeListing>,
  listing: TreeListing,
  corpus: Corpus,
): ReadonlyArray<MenuItem> => {
  const nodes = graphRoots(corpus).map(
    (node): MenuItem => ({ _tag: "node", listing, node }),
  )
  if (listing.kind !== "knowledge") return nodes
  const decks = attachedDecks(listings, listing).map(
    (deck): MenuItem => ({ _tag: "tree", listing: deck }),
  )
  return [...nodes, ...decks]
}

export const nodeItems = (
  listing: TreeListing,
  corpus: Corpus,
  nodeId: NodeId,
): ReadonlyArray<MenuItem> => [
  ...nodeCards(corpus, nodeId).map(
    (card): MenuItem => ({ _tag: "card", listing, card }),
  ),
  ...graphChildren(corpus, nodeId).map(
    (node): MenuItem => ({ _tag: "node", listing, node }),
  ),
]

export const homeItems = (): ReadonlyArray<MenuItem> => [
  { _tag: "option", id: "session" },
  { _tag: "option", id: "trees" },
  { _tag: "option", id: "status" },
]

const optionLabel = (id: "session" | "trees" | "status"): string => {
  if (id === "session") return "Session    due cards — inspect, then grade with consent"
  if (id === "trees") return "Trees      walk the map"
  return "Status     whether a log exists"
}

const paintTitle = (listing: TreeListing, ink: Palette): string =>
  listing.kind === "knowledge" ? ink.knowledge(listing.title) : ink.terms(listing.title)

const padTitle = (title: string, width: number): string =>
  title + " ".repeat(Math.max(0, width - title.length))

const aligned = (title: string, summary: string, width: number): string =>
  `${padTitle(title, width)}${TITLE_GAP}${summary}`

const labelOf = (item: MenuItem, corpus: Corpus | undefined): string => {
  if (item._tag === "option") return optionLabel(item.id)
  if (item._tag === "tree") return item.listing.title
  if (item._tag === "node") return item.node.title
  if (corpus === undefined) return item.card.prompt
  return `[${item.card._tag}] ${nodeTitle(corpus, item.card.nodeId)}`
}

const rootPainted = (
  listings: ReadonlyArray<TreeListing>,
  items: ReadonlyArray<MenuItem>,
  cursor: number,
  ink: Palette,
): ReadonlyArray<string> => {
  const width = Math.min(
    TITLE_CAP,
    items.reduce((w, item) => Math.max(w, labelOf(item, undefined).length), 0),
  )
  const lines: Array<{ text: string; selected: boolean }> = []
  let selectIndex = 0
  for (const item of items) {
    if (item._tag !== "tree") continue
    const selected = selectIndex === cursor
    selectIndex += 1
    lines.push({
      text: aligned(paintTitle(item.listing, ink), item.listing.summary, width),
      selected,
    })
    if (item.listing.kind !== "knowledge") continue
    const decks = attachedDecks(listings, item.listing)
    for (const [index, deck] of decks.entries()) {
      const prefix = index === decks.length - 1 ? BRANCH_END : BRANCH_MID
      lines.push({
        text: `${prefix}${ink.terms(deck.title)}${" ".repeat(Math.max(0, width - deck.title.length))}${TITLE_GAP}${deck.summary}`,
        selected: false,
      })
    }
  }
  return lines.map((line) => highlight(ink.enabled, line.selected, line.text))
}

const listPainted = (
  items: ReadonlyArray<MenuItem>,
  cursor: number,
  ink: Palette,
  corpus: Corpus | undefined,
): ReadonlyArray<string> => {
  const width = Math.min(
    TITLE_CAP,
    items.reduce((w, item) => Math.max(w, labelOf(item, corpus).length), 0),
  )
  return items.map((item, index) => {
    if (item._tag === "option") {
      return highlight(ink.enabled, index === cursor, optionLabel(item.id))
    }
    if (item._tag === "tree") {
      return highlight(
        ink.enabled,
        index === cursor,
        aligned(paintTitle(item.listing, ink), item.listing.summary, width),
      )
    }
    if (item._tag === "node") {
      return highlight(ink.enabled, index === cursor, ink.knowledge(item.node.title))
    }
    return highlight(ink.enabled, index === cursor, labelOf(item, corpus))
  })
}

const FOOTER = "j/k or arrows  enter  b back  q quit"

const header = (version: string, crumbs: string): string =>
  `retention ${version}\n${crumbs}`

const frame = (
  version: string,
  crumbs: string,
  rows: ReadonlyArray<string>,
  footer: string,
): string =>
  [CLEAR, header(version, crumbs), ...(rows.length === 0 ? ["nothing here"] : rows), footer].join(
    "\n",
  )

const loadCached = <R>(
  cache: Map<string, Corpus>,
  listing: TreeListing,
  load: (listing: TreeListing) => Effect.Effect<Corpus, SessionError, R>,
): Effect.Effect<Corpus, SessionError, R> =>
  Effect.gen(function* () {
    const hit = cache.get(listing.treeId)
    if (hit !== undefined) return hit
    const corpus = yield* load(listing)
    cache.set(listing.treeId, corpus)
    return corpus
  })

const opening = (entry: SessionEntry | undefined): Array<Frame> => {
  if (entry === undefined || entry._tag === "home") return [{ _tag: "home" }]
  if (entry._tag === "trees") return [{ _tag: "home" }, { _tag: "pick", purpose: "trees" }]
  return [{ _tag: "home" }, { _tag: "queue", listing: entry.listing }]
}

export const runSession = <RLoad, ROps>(
  io: SessionIo,
  ink: Palette,
  listings: ReadonlyArray<TreeListing>,
  load: (listing: TreeListing) => Effect.Effect<Corpus, SessionError, RLoad>,
  ops: SessionOps<ROps>,
  entry?: SessionEntry,
): Effect.Effect<void, SessionError, RLoad | ROps> =>
  Effect.gen(function* () {
    const cache = new Map<string, Corpus>()
    let stack: Array<Frame> = opening(entry)
    let cursor = 0
    let queueCards: ReadonlyArray<Card> = []
    const loop = Effect.gen(function* () {
      while (stack.length > 0) {
        const current = stack[stack.length - 1]
        if (current === undefined) return
        let items: ReadonlyArray<MenuItem> = []
        let crumbs = ink.dim("options")
        let corpus: Corpus | undefined
        let extra: ReadonlyArray<string> = []
        let footer = FOOTER
        if (current._tag === "home") {
          crumbs = ink.dim("options")
          items = homeItems()
          cursor = items.length === 0 ? 0 : cursor % items.length
          io.write(frame(ops.version, crumbs, listPainted(items, cursor, ink, undefined), footer))
        } else if (current._tag === "status") {
          crumbs = ink.dim("status")
          extra = [
            ops.logExists ? "event log: present" : ink.empty("event log: none yet"),
            "tree: (chosen in Session or Trees)",
          ]
          io.write(frame(ops.version, crumbs, extra, footer))
        } else if (current._tag === "pick") {
          crumbs = ink.dim(
            current.purpose === "session"
              ? "session — choose a tree"
              : "trees — walk the map",
          )
          items = rootItems(listings)
          cursor = items.length === 0 ? 0 : cursor % Math.max(items.length, 1)
          io.write(
            frame(ops.version, crumbs, rootPainted(listings, items, cursor, ink), footer),
          )
        } else if (current._tag === "queue") {
          const loaded = yield* loadCached(cache, current.listing, load)
          corpus = loaded
          crumbs = ink.dim(`session — ${current.listing.title}`)
          queueCards = yield* ops.queue(current.listing.treeId)
          items = queueCards.map((card) => ({
            _tag: "card" as const,
            listing: current.listing,
            card,
          }))
          cursor = items.length === 0 ? 0 : cursor % Math.max(items.length, 1)
          const rows =
            items.length === 0
              ? [ink.empty("queue empty")]
              : items.map((item, index) => {
                  if (item._tag !== "card") return ""
                  return highlight(
                    ink.enabled,
                    index === cursor,
                    ink.due(
                      `${index + 1}. [${item.card._tag}] ${nodeTitle(loaded, item.card.nodeId)}  ${item.card.prompt}`,
                    ),
                  )
                })
          io.write(frame(ops.version, crumbs, rows, footer))
        } else if (current._tag === "tree") {
          corpus = yield* loadCached(cache, current.listing, load)
          crumbs = ink.dim(`trees — ${current.listing.title}`)
          extra = locationLines(corpus).map((line) => ink.dim(line))
          items = treeItems(listings, current.listing, corpus)
          cursor = items.length === 0 ? 0 : cursor % Math.max(items.length, 1)
          io.write(
            frame(
              ops.version,
              crumbs,
              [...extra, "", ...listPainted(items, cursor, ink, corpus)],
              footer,
            ),
          )
        } else if (current._tag === "node") {
          corpus = yield* loadCached(cache, current.listing, load)
          const node = corpus.nodes.find((item) => item.id === current.nodeId)
          const title = node === undefined ? "unknown node" : node.title
          crumbs = ink.dim(`trees — ${current.listing.title} › ${title}`)
          extra = locationLines(corpus, current.nodeId).map((line) => ink.dim(line))
          items = nodeItems(current.listing, corpus, current.nodeId)
          cursor = items.length === 0 ? 0 : cursor % Math.max(items.length, 1)
          io.write(
            frame(
              ops.version,
              crumbs,
              [...extra, "", ...listPainted(items, cursor, ink, corpus)],
              footer,
            ),
          )
        } else if (current._tag === "card") {
          corpus = yield* loadCached(cache, current.listing, load)
          crumbs = ink.dim(
            current.fromQueue
              ? `session — ${current.listing.title} › ${nodeTitle(corpus, current.card.nodeId)}`
              : `trees — ${current.listing.title} › ${nodeTitle(corpus, current.card.nodeId)}`,
          )
          extra = current.fromQueue
            ? []
            : locationLines(corpus, current.card.nodeId).map((line) => ink.dim(line))
          footer = current.fromQueue
            ? "enter grade  b back  q quit"
            : FOOTER
          io.write(
            frame(
              ops.version,
              crumbs,
              [...extra, ...(extra.length > 0 ? [""] : []), ...formatShow(current.card, corpus).split("\n")],
              footer,
            ),
          )
        } else if (current._tag === "rating") {
          crumbs = ink.dim(`grade — ${current.listing.title}`)
          extra = RATINGS.map((rating, index) =>
            highlight(ink.enabled, index === cursor, rating),
          )
          footer = "enter a rating  b back  q quit"
          io.write(frame(ops.version, crumbs, extra, footer))
        } else {
          corpus = yield* loadCached(cache, current.listing, load)
          crumbs = ink.dim(`grade — ${current.listing.title}`)
          extra = [
            ink.warn(
              `Grade "${current.card.prompt}" (${nodeTitle(corpus, current.card.nodeId)}) as ${current.rating}.`,
            ),
            "This appends one review to the event log.",
            ...(ops.logExists ? [] : [ink.warn("This will create the event log.")]),
            "",
            highlight(ink.enabled, cursor === 0, "No"),
            highlight(ink.enabled, cursor === 1, "Yes"),
          ]
          footer = "Proceed? default No — y yes  n/enter no  q quit"
          io.write(frame(ops.version, crumbs, extra, footer))
        }

        const key = yield* io.readKey()
        if (key === undefined) {
          return yield* fail("Need an interactive terminal for session.")
        }
        if (key._tag === "quit") return
        if (current._tag === "consent") {
          if (key._tag === "no" || (key._tag === "enter" && cursor === 0) || key._tag === "back") {
            stack = stack.slice(0, -1)
            cursor = 0
            continue
          }
          if (key._tag === "yes" || (key._tag === "enter" && cursor === 1)) {
            yield* ops.grade(current.listing.treeId, current.card.id, current.rating)
            stack = stack.filter(
              (frame) =>
                frame._tag !== "consent" &&
                frame._tag !== "rating" &&
                !(frame._tag === "card" && frame.fromQueue),
            )
            cursor = 0
            continue
          }
          if (key._tag === "up" || key._tag === "down") {
            cursor = moveCursor(key, cursor, 2)
          }
          continue
        }
        if (key._tag === "back") {
          if (stack.length === 1) return
          stack = stack.slice(0, -1)
          cursor = 0
          continue
        }
        if (current._tag === "status" || current._tag === "card") {
          if (current._tag === "card" && current.fromQueue && key._tag === "enter") {
            stack = [...stack, { _tag: "rating", listing: current.listing, card: current.card }]
            cursor = 0
          }
          continue
        }
        if (current._tag === "rating") {
          if (key._tag === "up" || key._tag === "down") {
            cursor = moveCursor(key, cursor, RATINGS.length)
            continue
          }
          if (key._tag !== "enter") continue
          const rating = RATINGS[cursor]
          if (rating === undefined) continue
          stack = [
            ...stack,
            {
              _tag: "consent",
              listing: current.listing,
              card: current.card,
              rating,
            },
          ]
          cursor = 0
          continue
        }
        if (key._tag === "up" || key._tag === "down") {
          const length =
            current._tag === "queue" ? Math.max(queueCards.length, 1) : items.length
          cursor = moveCursor(key, cursor, length)
          continue
        }
        if (key._tag !== "enter") continue
        if (current._tag === "home") {
          const picked = items[cursor]
          if (picked === undefined || picked._tag !== "option") continue
          cursor = 0
          if (picked.id === "status") {
            stack = [...stack, { _tag: "status" }]
            continue
          }
          stack = [...stack, { _tag: "pick", purpose: picked.id }]
          continue
        }
        if (current._tag === "pick") {
          const picked = items[cursor]
          if (picked === undefined || picked._tag !== "tree") continue
          cursor = 0
          stack = [
            ...stack,
            current.purpose === "session"
              ? { _tag: "queue", listing: picked.listing }
              : { _tag: "tree", listing: picked.listing },
          ]
          continue
        }
        if (current._tag === "queue") {
          const card = queueCards[cursor]
          if (card === undefined) continue
          cursor = 0
          stack = [
            ...stack,
            { _tag: "card", listing: current.listing, card, fromQueue: true },
          ]
          continue
        }
        const picked = items[cursor]
        if (picked === undefined) continue
        cursor = 0
        if (picked._tag === "tree") {
          stack = [...stack, { _tag: "tree", listing: picked.listing }]
          continue
        }
        if (picked._tag === "node") {
          stack = [
            ...stack,
            { _tag: "node", listing: picked.listing, nodeId: picked.node.id },
          ]
          continue
        }
        if (picked._tag === "card") {
          stack = [
            ...stack,
            { _tag: "card", listing: picked.listing, card: picked.card, fromQueue: false },
          ]
        }
      }
    })
    yield* withAlternateScreen(
      io.write,
      io.raw === undefined ? loop : withRawMode(io.raw, loop),
    )
  })
