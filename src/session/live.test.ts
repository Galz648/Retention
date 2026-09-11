import { Clock, Effect, Layer, Schema } from "effect"
import { describe, expect, test } from "bun:test"
import { Live as CodecLive } from "../codec/layers.ts"
import { AlreadyArchived, CorpusNotFound, CorpusStore } from "../corpus/interface.ts"
import { CardReviewed } from "../domain/events.ts"
import {
  CardId,
  NodeId,
  RecallCard,
  TreeId,
} from "../domain/index.ts"
import { Corpus, Edge, Node } from "../domain/corpus.ts"
import { Live as GraphLive } from "../engine/graph/live.ts"
import { Live as MasteryLive } from "../engine/mastery/live.ts"
import { Live as SchedulerLive } from "../engine/scheduler/live.ts"
import { Event } from "../events/interface.ts"
import { ClockAt } from "../testing/clock.ts"
import { Codec } from "../codec/interface.ts"
import { Store } from "../store/interface.ts"
import { Memory } from "../store/memory.ts"
import { Session } from "./interface.ts"
import { Live } from "./live.ts"

const NOW = Date.parse("2026-03-10T12:00:00.000Z")

const asCardId = (s: string): CardId => Schema.decodeUnknownSync(CardId)(s)
const asNodeId = (s: string): NodeId => Schema.decodeUnknownSync(NodeId)(s)
const asTreeId = (s: string): TreeId => Schema.decodeUnknownSync(TreeId)(s)

const treeId = asTreeId("fixture")
const rootId = asNodeId("root")
const childId = asNodeId("child")
const rootCardId = asCardId("c-root")
const childCardId = asCardId("c-child")

const rootCard = new RecallCard({
  id: rootCardId,
  nodeId: rootId,
  prompt: "root?",
  answer: "yes",
  tags: [],
})

const childCard = new RecallCard({
  id: childCardId,
  nodeId: childId,
  prompt: "child?",
  answer: "yes",
  tags: [],
})

const fixture = new Corpus({
  treeId,
  title: "Fixture",
  kind: "knowledge",
  summary: "Test fixture.",
  archived: false,
  track: "university",
  belongsTo: undefined,
  nodes: [
    new Node({ id: rootId, title: "root", cardIds: [rootCardId] }),
    new Node({ id: childId, title: "child", cardIds: [childCardId] }),
  ],
  edges: [new Edge({ from: rootId, to: childId })],
  cards: [rootCard, childCard],
})

const CorpusFixed = Layer.succeed(
  CorpusStore,
  CorpusStore.of({
    read: (id) =>
      id === treeId
        ? Effect.succeed(fixture)
        : Effect.fail(new CorpusNotFound({ treeId: id })),
    list: () =>
      Effect.succeed([
        {
          treeId,
          title: fixture.title,
          kind: fixture.kind,
          track: fixture.track,
          summary: fixture.summary,
          archived: false,
          belongsTo: undefined,
          nodeCount: fixture.nodes.length,
          cardCount: fixture.cards.length,
          edgeCount: fixture.edges.length,
        },
      ]),
    archive: () => Effect.fail(new AlreadyArchived({ treeId })),
  }),
)

const sessionLayer = Live().pipe(
  Layer.provideMerge(Memory),
  Layer.provideMerge(CodecLive),
  Layer.provide(MasteryLive),
  Layer.provide(GraphLive),
  Layer.provide(SchedulerLive),
  Layer.provide(CorpusFixed),
)

const run = <A, E>(
  effect: Effect.Effect<A, E, Session | Store | Codec | Clock.Clock>,
  epochMillis = NOW,
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(sessionLayer),
      Effect.provide(ClockAt(epochMillis)),
    ),
  )

describe("Session.Live", () => {
  test("queue offers no card whose node has a prerequisite below THRESHOLD", async () => {
    const cards = await run(
      Effect.gen(function* () {
        const session = yield* Session
        return yield* session.queue(treeId)
      }),
    )
    expect(cards.map((card) => card.id)).toEqual([rootCardId])
  })

  test("grade appends exactly one CardReviewed and nothing else", async () => {
    const { events, cards } = await run(
      Effect.gen(function* () {
        const session = yield* Session
        const store = yield* Store
        const codec = yield* Codec
        yield* session.grade(treeId, rootCardId, "Easy")
        const snapshot = yield* store.read()
        const decoded: Array<Event> = []
        for (const record of snapshot.records) {
          decoded.push(yield* codec.decode(record))
        }
        const queue = yield* session.queue(treeId)
        return { events: decoded, cards: queue }
      }),
    )
    expect(events.length).toBe(1)
    const event = events[0]
    expect(event).toBeInstanceOf(CardReviewed)
    if (event instanceof CardReviewed) {
      expect(event.id).toBe(rootCardId)
      expect(event.rating).toBe("Easy")
    }
    expect(cards.map((card) => card.id)).toEqual([childCardId])
  })

  test("unknown card is not written", async () => {
    const result = await run(
      Effect.gen(function* () {
        const session = yield* Session
        const store = yield* Store
        const flipped = yield* Effect.flip(
          session.grade(treeId, asCardId("ghost"), "Good"),
        )
        const snapshot = yield* store.read()
        return { flipped, records: snapshot.records }
      }),
    )
    expect(result.flipped._tag).toBe("SessionError")
    expect(result.records).toEqual([])
  })

  test("session live does not compute Brightness or THRESHOLD", async () => {
    const text = await Bun.file(new URL("./live.ts", import.meta.url)).text()
    expect(text).not.toMatch(/forgetting_curve/)
    expect(text).not.toMatch(/THRESHOLD/)
    expect(text).not.toMatch(/Date\.now/)
    expect(text).not.toMatch(/Clock\.make/)
    expect(text).not.toMatch(/ClockAt/)
  })
})
