import { Effect, Schema } from "effect"
import { describe, expect, test } from "bun:test"
import { Brightness } from "../domain/brightness.ts"
import { Corpus, Edge, Node } from "../domain/corpus.ts"
import { NodeId, TreeId } from "../domain/ids.ts"
import { Live } from "../engine/graph/live.ts"
import { eligibleLines, fullSnapshot, zeroSnapshot } from "./graph.ts"

const nodeId = (raw: string): NodeId => Schema.decodeUnknownSync(NodeId)(raw)
const treeId = Schema.decodeUnknownSync(TreeId)("fixture-tree")
const asBrightness = (value: number): Brightness =>
  Schema.decodeUnknownSync(Brightness)(value)

const idA = nodeId("node-a")
const idB = nodeId("node-b")

const corpus = new Corpus({
  treeId,
  title: "Fixture",
  kind: "knowledge",
  summary: "A then B.",
  archived: false,
  track: "university",
  belongsTo: undefined,
  nodes: [
    new Node({ id: idA, title: "A", cardIds: [] }),
    new Node({ id: idB, title: "B", cardIds: [] }),
  ],
  edges: [new Edge({ from: idA, to: idB })],
  cards: [],
})

const print = (snapshot: ReadonlyMap<NodeId, Brightness>): string =>
  Effect.runSync(eligibleLines(corpus, snapshot).pipe(Effect.provide(Live)))

describe("zeroSnapshot / fullSnapshot", () => {
  test("zero is 0 on every node; full is 1", () => {
    const zero = zeroSnapshot(corpus)
    const full = fullSnapshot(corpus)
    expect(zero.size).toBe(2)
    expect(full.size).toBe(2)
    expect(zero.get(idA)).toBe(asBrightness(0))
    expect(zero.get(idB)).toBe(asBrightness(0))
    expect(full.get(idA)).toBe(asBrightness(1))
    expect(full.get(idB)).toBe(asBrightness(1))
  })
})

describe("eligibleLines", () => {
  test("zero snapshot: A eligible, B blocked by A", () => {
    const text = print(zeroSnapshot(corpus))
    expect(text).not.toContain("node-a")
    expect(text).not.toContain("node-b")
    expect(text).not.toContain("fixture-tree")
    const blockedAt = text.indexOf("Blocked")
    expect(blockedAt).toBeGreaterThan(-1)
    const eligible = text.slice(0, blockedAt)
    const blocked = text.slice(blockedAt)
    expect(eligible).toContain("A")
    expect(eligible).not.toContain("B")
    expect(blocked).toContain("B")
    expect(blocked).toMatch(/needs A/)
  })

  test("full snapshot: both eligible", () => {
    const text = print(fullSnapshot(corpus))
    expect(text).not.toContain("node-a")
    expect(text).not.toContain("node-b")
    expect(text).toContain("A")
    expect(text).toContain("B")
    expect(text).not.toContain("Blocked")
    expect(text).not.toMatch(/needs/)
  })
})

describe("graph.ts isolation", () => {
  test("does not import mastery, scheduler, Session, or graph live", async () => {
    const text = await Bun.file(new URL("./graph.ts", import.meta.url)).text()
    expect(text).not.toMatch(/engine\/mastery/)
    expect(text).not.toMatch(/engine\/scheduler/)
    expect(text).not.toMatch(/engine\/graph\/live/)
    expect(text).not.toMatch(/\bSession\b/)
    expect(text).not.toMatch(/\b0\.9\b/)
  })
})
