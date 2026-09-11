import { type Clock, Effect, Layer, Schema } from "effect"
import { describe, expect, test } from "bun:test"
import { Live as CodecLive } from "../codec/layers.ts"
import { AlreadyArchived, CorpusNotFound, CorpusStore } from "../corpus/interface.ts"
import { Brightness } from "../domain/brightness.ts"
import { DerivationCard, RecallCard } from "../domain/cards.ts"
import { Corpus, Edge, Node } from "../domain/corpus.ts"
import { CardId, NodeId, TreeId } from "../domain/ids.ts"
import { Mastery } from "../engine/mastery/interface.ts"
import { Live as MasteryLive } from "../engine/mastery/live.ts"
import { ClockAt } from "../testing/clock.ts"
import { Codec } from "../codec/interface.ts"
import { NotFound, Store } from "../store/interface.ts"
import { Memory } from "../store/memory.ts"
import { brightnessLines, evaluateTree } from "./mastery.ts"

const NOW = Date.parse("2026-03-10T12:00:00.000Z")

const asCardId = (s: string): CardId => Schema.decodeUnknownSync(CardId)(s)
const asNodeId = (s: string): NodeId => Schema.decodeUnknownSync(NodeId)(s)
const asTreeId = (s: string): TreeId => Schema.decodeUnknownSync(TreeId)(s)
const asBrightness = (n: number): Brightness =>
  Schema.decodeUnknownSync(Brightness)(n)

const treeId = asTreeId("tree-xyz")
const diffusionId = asNodeId("node-diffusion")
const osmosisId = asNodeId("node-osmosis")
const recallId = asCardId("card-aaa")
const derivationId = asCardId("card-bbb")

const recall = new RecallCard({
  id: recallId,
  nodeId: diffusionId,
  prompt: "What moves down a gradient?",
  answer: "Net movement.",
  tags: [],
})

const derivation = new DerivationCard({
  id: derivationId,
  nodeId: osmosisId,
  prompt: "Derive the osmotic balance.",
  tags: [],
  mustHits: ["water", "solute"],
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
    new Node({ id: diffusionId, title: "Diffusion", cardIds: [recallId] }),
    new Node({ id: osmosisId, title: "Osmosis", cardIds: [derivationId] }),
  ],
  edges: [] as ReadonlyArray<Edge>,
  cards: [recall, derivation],
})

const CorpusFixed = Layer.succeed(
  CorpusStore,
  CorpusStore.of({
    read: (id) =>
      id === treeId
        ? Effect.succeed(fixture)
        : Effect.fail(new CorpusNotFound({ treeId: id })),
    list: () => Effect.succeed([]),
    archive: () => Effect.fail(new AlreadyArchived({ treeId })),
  }),
)

const run = <A, E>(
  effect: Effect.Effect<A, E, Mastery | CorpusStore | Store | Codec | Clock.Clock>,
  store: Layer.Layer<Store> = Memory,
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(MasteryLive),
      Effect.provide(CorpusFixed),
      Effect.provide(store),
      Effect.provide(CodecLive),
      Effect.provide(ClockAt(NOW)),
    ),
  )

const trailingNumber = (line: string): number => {
  const match = line.match(/(\d+(?:\.\d+)?)\s*$/)
  if (match === null || match[1] === undefined) {
    throw new Error(`expected trailing number in: ${line}`)
  }
  return Number(match[1])
}

describe("brightnessLines", () => {
  test("one line per card: node title, type, prompt, brightness — no ids", () => {
    const values = new Map<CardId, Brightness>([
      [recallId, asBrightness(0.5)],
      [derivationId, asBrightness(1)],
    ])
    const text = brightnessLines(fixture, values)
    expect(text).toBe(
      "Diffusion [recall] What moves down a gradient? 0.5\nOsmosis [derivation] Derive the osmotic balance. 1",
    )
    expect(text).not.toContain(recallId)
    expect(text).not.toContain(derivationId)
    expect(text).not.toContain(treeId)
    expect(text).not.toContain("tree-xyz")
    expect(text).not.toContain("node-diffusion")
  })
})

describe("evaluateTree", () => {
  test("unreviewed cards still get a Brightness in [0, 1]; output is titles not ids", async () => {
    const text = await run(evaluateTree(treeId))
    const lines = text.split("\n")
    expect(lines).toHaveLength(2)
    expect(text).toContain("Diffusion")
    expect(text).toContain("Osmosis")
    expect(text).toContain("[recall]")
    expect(text).toContain("[derivation]")
    expect(text).toContain("What moves down a gradient?")
    expect(text).not.toContain(recallId)
    expect(text).not.toContain(derivationId)
    expect(text).not.toContain(treeId)
    for (const line of lines) {
      const brightness = trailingNumber(line)
      expect(brightness).toBeGreaterThanOrEqual(0)
      expect(brightness).toBeLessThanOrEqual(1)
    }
  })

  test("empty store does not append", async () => {
    const result = await run(
      Effect.gen(function* () {
        const store = yield* Store
        const before = yield* store.read()
        const text = yield* evaluateTree(treeId)
        const after = yield* store.read()
        return { before, after, text }
      }),
    )
    expect(result.before.records).toEqual([])
    expect(result.after.records).toEqual([])
    expect(result.text).toContain("Diffusion")
  })

  test("Store NotFound is empty history and does not append", async () => {
    let appended = 0
    const missing = Layer.succeed(
      Store,
      Store.of({
        append: () =>
          Effect.sync(() => {
            appended += 1
          }),
        read: () => Effect.fail(new NotFound({ path: "log.jsonl" })),
      }),
    )
    const text = await run(evaluateTree(treeId), missing)
    expect(appended).toBe(0)
    expect(text).toContain("Diffusion")
    expect(text).toContain("Osmosis")
    for (const line of text.split("\n")) {
      const brightness = trailingNumber(line)
      expect(brightness).toBeGreaterThanOrEqual(0)
      expect(brightness).toBeLessThanOrEqual(1)
    }
  })

  test("unterminated log is SessionError reason unterminated", async () => {
    const torn = Layer.succeed(
      Store,
      Store.of({
        append: () => Effect.void,
        read: () =>
          Effect.succeed({
            records: [],
            unterminated: '{"torn":',
          }),
      }),
    )
    const flipped = await run(Effect.flip(evaluateTree(treeId)), torn)
    expect(flipped._tag).toBe("SessionError")
    expect(flipped.reason).toBe("unterminated")
  })

  test("module stays isolated from graph, scheduler, and Session", async () => {
    const text = await Bun.file(new URL("./mastery.ts", import.meta.url)).text()
    expect(text).toMatch(/engine\/mastery\/interface/)
    expect(text).not.toMatch(/engine\/graph/)
    expect(text).not.toMatch(/engine\/scheduler/)
    expect(text).not.toMatch(/session\/live/)
    expect(text).not.toMatch(/store\.append/)
    expect(text).not.toMatch(/\bSession\b/)
  })
})
