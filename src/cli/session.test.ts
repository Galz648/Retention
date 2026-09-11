import { Effect, Schema } from "effect"
import { describe, expect, test } from "bun:test"
import { RecallCard } from "../domain/cards.ts"
import { Corpus, Edge, Node, type TreeListing } from "../domain/corpus.ts"
import { CardId, NodeId, TreeId } from "../domain/ids.ts"
import { palette } from "./style.ts"
import {
  graphChildren,
  graphRoots,
  locationLines,
  rootItems,
  runSession,
  treeItems,
  type SessionOps,
} from "./session.ts"
import { VERSION } from "./version.ts"
import { CLEAR, ENTER_ALT, LEAVE_ALT, type Key } from "./tui.ts"

const treeId = (s: string) => Schema.decodeUnknownSync(TreeId)(s)
const nodeId = (s: string) => Schema.decodeUnknownSync(NodeId)(s)
const cardId = (s: string) => Schema.decodeUnknownSync(CardId)(s)

const biologyId = treeId("biology-ii")
const ecologyId = treeId("terms-biology-ii-ecology")
const germanId = treeId("terms-german-frequency-core")
const diffusionId = nodeId("diffusion")
const osmosisId = nodeId("osmosis")
const popId = nodeId("population")
const wortId = nodeId("wort")
const diffusionCard = new RecallCard({
  id: cardId("der-diffusion"),
  nodeId: diffusionId,
  prompt: "Explain Diffusion from scratch.",
  answer: "Net movement down a gradient.",
  tags: [],
})
const osmosisCard = new RecallCard({
  id: cardId("der-osmosis"),
  nodeId: osmosisId,
  prompt: "Explain Osmosis from scratch.",
  answer: "Water follows solute.",
  tags: [],
})
const popCard = new RecallCard({
  id: cardId("rec-population"),
  nodeId: popId,
  prompt: "What is a population?",
  answer: "Individuals of one species in an area.",
  tags: [],
})
const wortCard = new RecallCard({
  id: cardId("rec-wort"),
  nodeId: wortId,
  prompt: "What does Wort mean?",
  answer: "word",
  tags: [],
})

const biology: TreeListing = {
  treeId: biologyId,
  title: "Biology II",
  kind: "knowledge",
  track: "university",
  summary: "Animal systems and ecology, from the course map.",
  archived: false,
  belongsTo: undefined,
  nodeCount: 2,
  cardCount: 2,
  edgeCount: 1,
}

const ecology: TreeListing = {
  treeId: ecologyId,
  title: "Biology II ecology terms",
  kind: "terms",
  track: "university",
  summary: "Names and conventions from ecology.",
  archived: false,
  belongsTo: biologyId,
  nodeCount: 1,
  cardCount: 1,
  edgeCount: 0,
}

const german: TreeListing = {
  treeId: germanId,
  title: "German frequency terms",
  kind: "terms",
  track: "curiosity",
  summary: "Core words, first slice.",
  archived: false,
  belongsTo: undefined,
  nodeCount: 1,
  cardCount: 1,
  edgeCount: 0,
}

const biologyCorpus = new Corpus({
  treeId: biologyId,
  title: biology.title,
  kind: "knowledge",
  track: biology.track,
  summary: biology.summary,
  archived: false,
  belongsTo: undefined,
  nodes: [
    new Node({ id: diffusionId, title: "Diffusion", cardIds: [diffusionCard.id] }),
    new Node({ id: osmosisId, title: "Osmosis", cardIds: [osmosisCard.id] }),
  ],
  edges: [new Edge({ from: diffusionId, to: osmosisId })],
  cards: [diffusionCard, osmosisCard],
})

const ecologyCorpus = new Corpus({
  treeId: ecologyId,
  title: ecology.title,
  kind: "terms",
  track: ecology.track,
  summary: ecology.summary,
  archived: false,
  belongsTo: biologyId,
  nodes: [new Node({ id: popId, title: "population", cardIds: [popCard.id] })],
  edges: [],
  cards: [popCard],
})

const germanCorpus = new Corpus({
  treeId: germanId,
  title: german.title,
  kind: "terms",
  track: german.track,
  summary: german.summary,
  archived: false,
  belongsTo: undefined,
  nodes: [new Node({ id: wortId, title: "Wort", cardIds: [wortCard.id] })],
  edges: [],
  cards: [wortCard],
})

const listings = [biology, ecology, german]
const corpora = new Map([
  [biologyId, biologyCorpus],
  [ecologyId, ecologyCorpus],
  [germanId, germanCorpus],
])

const load = (listing: TreeListing) => {
  const corpus = corpora.get(listing.treeId)
  if (corpus === undefined) {
    return Effect.die("missing corpus")
  }
  return Effect.succeed(corpus)
}

const ops: SessionOps<never> = {
  version: VERSION,
  logExists: false,
  queue: (treeId) => {
    const corpus = corpora.get(treeId)
    return Effect.succeed(corpus === undefined ? [] : corpus.cards)
  },
  grade: () => Effect.void,
}

const play = async (keys: ReadonlyArray<Key>, entry?: Parameters<typeof runSession>[5]) => {
  const lines: Array<string> = []
  let index = 0
  await Effect.runPromise(
    runSession(
      {
        write: (line) => lines.push(line),
        readKey: () => {
          const next = keys[index]
          index += 1
          return Effect.succeed(next)
        },
      },
      palette(false),
      listings,
      load,
      ops,
      entry,
    ),
  )
  return lines.join("\n")
}

describe("session graph", () => {
  test("roots are nodes with no incoming edge", () => {
    expect(graphRoots(biologyCorpus).map((node) => node.title)).toEqual(["Diffusion"])
    expect(graphChildren(biologyCorpus, diffusionId).map((node) => node.title)).toEqual([
      "Osmosis",
    ])
  })

  test("root menu is knowledge trees plus unattached decks on one track", () => {
    expect(
      rootItems(listings, "university").map((item) =>
        item._tag === "tree" ? item.listing.title : "",
      ),
    ).toEqual(["Biology II"])
    expect(
      rootItems(listings, "curiosity").map((item) =>
        item._tag === "tree" ? item.listing.title : "",
      ),
    ).toEqual(["German frequency terms"])
  })

  test("location marks the current node in the path", () => {
    expect(locationLines(biologyCorpus)).toEqual(["Biology II", "  Diffusion"])
    expect(locationLines(biologyCorpus, osmosisId)).toEqual([
      "Biology II",
      "  Diffusion",
      "  ● Osmosis",
    ])
  })

  test("knowledge tree menu has roots then attached decks", () => {
    const items = treeItems(listings, biology, biologyCorpus)
    expect(
      items.map((item) =>
        item._tag === "node" ? item.node.title : item._tag === "tree" ? item.listing.title : "",
      ),
    ).toEqual(["Diffusion", "Biology II ecology terms"])
  })
})

describe("runSession", () => {
  test("home is the options menu with version; q restores the screen", async () => {
    const text = await play([{ _tag: "quit" }])
    expect(text).toContain(ENTER_ALT)
    expect(text).toContain(LEAVE_ALT)
    expect(text).toContain(CLEAR)
    expect(text).toContain(`retention ${VERSION}`)
    expect(text).toContain("options")
    expect(text).toContain("Session")
    expect(text).toContain("Trees")
    expect(text).toContain("Status")
    expect(text).toContain("> ")
    expect(text).not.toContain("biology-ii")
  })

  test("Session opens the due queue, inspects, grades only after consent", async () => {
    const graded: Array<string> = []
    const recording: SessionOps<never> = {
      ...ops,
      grade: (_tree, id, rating) =>
        Effect.sync(() => {
          graded.push(`${id}:${rating}`)
        }),
    }
    const keys: ReadonlyArray<Key> = [
      { _tag: "enter" },
      { _tag: "enter" },
      { _tag: "enter" },
      { _tag: "enter" },
      { _tag: "enter" },
      { _tag: "down" },
      { _tag: "enter" },
      { _tag: "yes" },
      { _tag: "quit" },
    ]
    const lines: Array<string> = []
    let index = 0
    await Effect.runPromise(
      runSession(
        {
          write: (line) => lines.push(line),
          readKey: () => {
            const next = keys[index]
            index += 1
            return Effect.succeed(next)
          },
        },
        palette(false),
        listings,
        load,
        recording,
      ),
    )
    const text = lines.join("\n")
    expect(text).toContain("session — choose a track")
    expect(text).toContain("University")
    expect(text).toContain("session — choose a tree")
    expect(text).toContain("session — Biology II")
    expect(text).toContain("Explain Diffusion from scratch.")
    expect(text).toContain("Net movement down a gradient.")
    expect(text).toContain("This appends one review")
    expect(text).toContain("This will create the event log.")
    expect(graded).toEqual([`${diffusionCard.id}:Hard`])
  })

  test("grade default No does not write", async () => {
    const graded: Array<string> = []
    const recording: SessionOps<never> = {
      ...ops,
      grade: (_tree, id, rating) =>
        Effect.sync(() => {
          graded.push(`${id}:${rating}`)
        }),
    }
    const keys: ReadonlyArray<Key> = [
      { _tag: "enter" },
      { _tag: "enter" },
      { _tag: "enter" },
      { _tag: "enter" },
      { _tag: "enter" },
      { _tag: "enter" },
      { _tag: "enter" },
      { _tag: "quit" },
    ]
    let index = 0
    await Effect.runPromise(
      runSession(
        {
          write: () => {},
          readKey: () => {
            const next = keys[index]
            index += 1
            return Effect.succeed(next)
          },
        },
        palette(false),
        listings,
        load,
        recording,
      ),
    )
    expect(graded).toEqual([])
  })

  test("Trees walk shows you-are-here and can inspect a card", async () => {
    const text = await play(
      [
        { _tag: "down" },
        { _tag: "enter" },
        { _tag: "enter" },
        { _tag: "enter" },
        { _tag: "enter" },
        { _tag: "enter" },
        { _tag: "back" },
        { _tag: "quit" },
      ],
      { _tag: "home" },
    )
    expect(text).toContain("trees — choose a track")
    expect(text).toContain("trees — walk the map")
    expect(text).toContain("trees — Biology II")
    expect(text).toContain("Biology II")
    expect(text).toContain("  Diffusion")
    expect(text).toContain("●")
    expect(text).toContain("Explain Diffusion from scratch.")
    expect(text).toContain("Net movement down a gradient.")
  })
})
