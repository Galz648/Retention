import { Effect, Schema } from "effect"
import { describe, expect, test } from "bun:test"
import { THRESHOLD } from "../config.ts"
import { Brightness } from "../domain/brightness.ts"
import { DerivationCard, RecallCard } from "../domain/cards.ts"
import { Corpus, Edge, Node } from "../domain/corpus.ts"
import { CardId, NodeId, TreeId } from "../domain/ids.ts"
import { Live as SchedulerLive } from "../engine/scheduler/live.ts"
import { dueLines, fullValues, zeroValues } from "./scheduler.ts"

const asCardId = (s: string): CardId => Schema.decodeUnknownSync(CardId)(s)
const asNodeId = (s: string): NodeId => Schema.decodeUnknownSync(NodeId)(s)
const asTreeId = (s: string): TreeId => Schema.decodeUnknownSync(TreeId)(s)
const asBrightness = (n: number): Brightness =>
  Schema.decodeUnknownSync(Brightness)(n)

const diffusionId = asCardId("der-diffusion")
const osmosisId = asCardId("der-osmosis")
const diffusionNode = asNodeId("diffusion")
const osmosisNode = asNodeId("osmosis")

const diffusion = new RecallCard({
  id: diffusionId,
  nodeId: diffusionNode,
  prompt: "Explain Diffusion from scratch.",
  answer: "Net movement down a gradient.",
  tags: [],
})

const osmosis = new DerivationCard({
  id: osmosisId,
  nodeId: osmosisNode,
  prompt: "Derive the osmosis relation.",
  tags: [],
  mustHits: ["water", "solute"],
})

const corpus = new Corpus({
  treeId: asTreeId("biology-ii"),
  title: "Biology II",
  kind: "knowledge",
  summary: "Animal systems and ecology, from the course map.",
  archived: false,
  track: "university",
  belongsTo: undefined,
  nodes: [
    new Node({ id: diffusionNode, title: "Diffusion", cardIds: [diffusionId] }),
    new Node({ id: osmosisNode, title: "Osmosis", cardIds: [osmosisId] }),
  ],
  edges: [] as ReadonlyArray<Edge>,
  cards: [diffusion, osmosis],
})

const printDue = (
  values: ReadonlyMap<CardId, Brightness>,
): Promise<string> =>
  Effect.runPromise(dueLines(corpus, values).pipe(Effect.provide(SchedulerLive)))

describe("scheduler CLI", () => {
  test("sub-threshold card prints as title, type, prompt — not id", async () => {
    expect(0.1).toBeLessThan(THRESHOLD)
    expect(1).toBeGreaterThanOrEqual(THRESHOLD)
    const text = await printDue(
      new Map([
        [diffusionId, asBrightness(0.1)],
        [osmosisId, asBrightness(1)],
      ]),
    )
    expect(text).toContain("Diffusion")
    expect(text).toContain("[recall]")
    expect(text).toContain("Explain Diffusion from scratch.")
    expect(text).not.toContain("der-diffusion")
    expect(text).not.toContain("der-osmosis")
    expect(text).not.toContain("Osmosis")
    expect(text).not.toContain("none due")
  })

  test("all-1 prints none due", async () => {
    expect(await printDue(fullValues(corpus.cards))).toBe("none due")
  })

  test("all-0 prints both cards by title", async () => {
    const text = await printDue(zeroValues(corpus.cards))
    expect(text).toContain("Diffusion")
    expect(text).toContain("[recall]")
    expect(text).toContain("Osmosis")
    expect(text).toContain("[derivation]")
    expect(text).not.toContain("der-diffusion")
    expect(text).not.toContain("der-osmosis")
    expect(text).not.toBe("none due")
  })

  test("module does not import mastery or graph engines", async () => {
    const src = await Bun.file(new URL("./scheduler.ts", import.meta.url)).text()
    expect(src).not.toMatch(/engine\/mastery/)
    expect(src).not.toMatch(/engine\/graph/)
    expect(src).not.toMatch(/0\.9/)
    expect(src).toMatch(/THRESHOLD/)
  })
})
