import { Effect, Schema } from "effect"
import * as fc from "effect/FastCheck"
import { describe, expect, test } from "bun:test"
import { THRESHOLD } from "../../config.ts"
import { Brightness } from "../../domain/brightness.ts"
import { Corpus, Edge, Node } from "../../domain/corpus.ts"
import { NodeId, TreeId } from "../../domain/ids.ts"
import { Graph } from "./interface.ts"
import { Live } from "./live.ts"

const nodeId = (raw: string): NodeId => Schema.decodeUnknownSync(NodeId)(raw)
const treeId = Schema.decodeUnknownSync(TreeId)("tree")
const brightness = (value: number): Brightness =>
  Schema.decodeUnknownSync(Brightness)(value)

const node = (id: string): Node =>
  new Node({ id: nodeId(id), title: id, cardIds: [] })

const edge = (from: string, to: string): Edge =>
  new Edge({ from: nodeId(from), to: nodeId(to) })

const corpusOf = (
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge>,
  archived = false,
): Corpus =>
  new Corpus({
    treeId,
    title: "Fixture",
    kind: "knowledge",
    summary: "Test fixture.",
    archived,
    nodes,
    edges,
    cards: [],
  })

const snapshotOf = (
  entries: ReadonlyArray<readonly [string, number]>,
): ReadonlyMap<NodeId, Brightness> =>
  new Map(entries.map(([id, value]) => [nodeId(id), brightness(value)]))

const eligible = (
  corpus: Corpus,
  snapshot: ReadonlyMap<NodeId, Brightness>,
): ReadonlyArray<NodeId> =>
  Effect.runSync(
    Effect.gen(function* () {
      const graph = yield* Graph
      return yield* graph.eligible(corpus, snapshot)
    }).pipe(Effect.provide(Live)),
  )

const validPrereqs = (corpus: Corpus, id: NodeId): Array<NodeId> => {
  const nodeIds = new Set(corpus.nodes.map((item) => item.id))
  const found: Array<NodeId> = []
  for (const item of corpus.edges) {
    if (item.to !== id) continue
    if (!nodeIds.has(item.from) || !nodeIds.has(item.to)) continue
    found.push(item.from)
  }
  return found
}

const brightnessOrZero = (
  snapshot: ReadonlyMap<NodeId, Brightness>,
  id: NodeId,
): number => {
  const value = snapshot.get(id)
  return value === undefined ? 0 : value
}

type Case = {
  corpus: Corpus
  snapshot: ReadonlyMap<NodeId, Brightness>
}

const arbCase: fc.Arbitrary<Case> = fc
  .integer({ min: 0, max: 8 })
  .chain((n) => {
    const ids = Array.from({ length: n }, (_, i) =>
      nodeId(`n${String(i).padStart(2, "0")}`),
    )
    const pairs: Array<readonly [number, number]> = []
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pairs.push([i, j])
      }
    }
    const indexArb =
      n === 0 ? fc.constant(0) : fc.integer({ min: 0, max: n - 1 })
    const orderArb =
      n === 0
        ? fc.constant<Array<number>>([])
        : fc.shuffledSubarray(
            Array.from({ length: n }, (_, i) => i),
            { minLength: n, maxLength: n },
          )
    return fc
      .tuple(
        fc.array(fc.boolean(), {
          minLength: pairs.length,
          maxLength: pairs.length,
        }),
        fc.array(fc.integer({ min: 0, max: 100 }), {
          minLength: n,
          maxLength: n,
        }),
        fc.array(fc.boolean(), { minLength: n, maxLength: n }),
        fc.array(
          fc.record({
            fromKind: fc.constantFrom("real", "ghost"),
            toKind: fc.constantFrom("real", "ghost"),
            fromIdx: indexArb,
            toIdx: indexArb,
            ghostFrom: fc.integer({ min: 0, max: 9 }),
            ghostTo: fc.integer({ min: 0, max: 9 }),
          }),
          { maxLength: 5 },
        ),
        orderArb,
      )
      .map(([edgeBits, scores, present, dangling, order]) => {
        const nodes = order.flatMap((idx) => {
          const id = ids[idx]
          return id === undefined ? [] : [new Node({ id, title: id, cardIds: [] })]
        })
        const edges: Array<Edge> = []
        for (let k = 0; k < pairs.length; k++) {
          const pair = pairs[k]
          if (pair === undefined || edgeBits[k] !== true) continue
          const from = ids[pair[0]]
          const to = ids[pair[1]]
          if (from === undefined || to === undefined) continue
          edges.push(new Edge({ from, to }))
        }
        for (const extra of dangling) {
          const from =
            extra.fromKind === "real" && n > 0
              ? ids[extra.fromIdx]
              : nodeId(`ghost-from-${extra.ghostFrom}`)
          const to =
            extra.toKind === "real" && n > 0
              ? ids[extra.toIdx]
              : nodeId(`ghost-to-${extra.ghostTo}`)
          if (from === undefined || to === undefined) continue
          edges.push(new Edge({ from, to }))
        }
        const snapshot = new Map<NodeId, Brightness>()
        for (let i = 0; i < n; i++) {
          if (present[i] !== true) continue
          const id = ids[i]
          const score = scores[i]
          if (id === undefined || score === undefined) continue
          snapshot.set(id, brightness(score / 100))
        }
        return {
          corpus: corpusOf(nodes, edges),
          snapshot,
        }
      })
  })

describe("Graph.Live", () => {
  test("INV-B-GRF-01: never returns a node while a prerequisite is below THRESHOLD", () => {
    fc.assert(
      fc.property(arbCase, ({ corpus, snapshot }) => {
        const result = eligible(corpus, snapshot)
        for (const id of result) {
          for (const from of validPrereqs(corpus, id)) {
            expect(brightnessOrZero(snapshot, from)).toBeGreaterThanOrEqual(
              THRESHOLD,
            )
          }
        }
      }),
      { numRuns: 100 },
    )
  })

  test("INV-B-GRF-02: archived corpus yields an empty list", () => {
    fc.assert(
      fc.property(arbCase, ({ corpus, snapshot }) => {
        const archived = corpusOf(corpus.nodes, corpus.edges, true)
        expect(eligible(archived, snapshot)).toEqual([])
      }),
      { numRuns: 100 },
    )
  })

  test("INV-B-GRF-03: isolated node with no prerequisites is eligible", () => {
    const corpus = corpusOf([node("solo")], [])
    expect(eligible(corpus, new Map())).toEqual([nodeId("solo")])
    expect(eligible(corpus, snapshotOf([["solo", 0]]))).toEqual([nodeId("solo")])
  })

  test("INV-B-GRF-03: nodes with only ignored dangling inbound edges are eligible", () => {
    fc.assert(
      fc.property(arbCase, ({ corpus, snapshot }) => {
        const result = new Set(eligible(corpus, snapshot))
        for (const item of corpus.nodes) {
          if (validPrereqs(corpus, item.id).length === 0) {
            expect(result.has(item.id)).toBe(true)
          }
        }
      }),
      { numRuns: 100 },
    )
  })

  test("INV-B-GRF-04: same corpus and snapshot yield identical output", () => {
    fc.assert(
      fc.property(arbCase, ({ corpus, snapshot }) => {
        expect(eligible(corpus, snapshot)).toEqual(eligible(corpus, snapshot))
      }),
      { numRuns: 100 },
    )
  })

  test("INV-B-GRF-04: eligible ids are sorted and drawn only from corpus nodes", () => {
    fc.assert(
      fc.property(arbCase, ({ corpus, snapshot }) => {
        const result = eligible(corpus, snapshot)
        const nodeIds = new Set(corpus.nodes.map((item) => item.id))
        expect(result).toEqual([...result].sort())
        for (const id of result) {
          expect(nodeIds.has(id)).toBe(true)
        }
      }),
      { numRuns: 100 },
    )
  })

  test("INV-B-GRF-04: node order in the corpus does not change the result", () => {
    fc.assert(
      fc.property(arbCase, fc.array(fc.nat()), ({ corpus, snapshot }, salts) => {
        const rotated = [...corpus.nodes]
        for (const salt of salts) {
          if (rotated.length === 0) break
          const idx = salt % rotated.length
          const picked = rotated.splice(idx, 1)
          const head = picked[0]
          if (head === undefined) continue
          rotated.push(head)
        }
        const shuffled = corpusOf(rotated, corpus.edges)
        expect(eligible(shuffled, snapshot)).toEqual(eligible(corpus, snapshot))
      }),
      { numRuns: 100 },
    )
  })

  test("INV-B-GRF-01: chain: missing snapshot treats prerequisites as 0", () => {
    const corpus = corpusOf(
      [node("a"), node("b"), node("c")],
      [edge("a", "b"), edge("b", "c")],
    )
    expect(eligible(corpus, new Map())).toEqual([nodeId("a")])
  })

  test("chain: brightness at THRESHOLD unlocks dependents", () => {
    const corpus = corpusOf(
      [node("c"), node("a"), node("b")],
      [edge("a", "b"), edge("b", "c")],
    )
    expect(eligible(corpus, snapshotOf([["a", THRESHOLD]]))).toEqual([
      nodeId("a"),
      nodeId("b"),
    ])
    expect(
      eligible(
        corpus,
        snapshotOf([
          ["a", THRESHOLD],
          ["b", THRESHOLD],
        ]),
      ),
    ).toEqual([nodeId("a"), nodeId("b"), nodeId("c")])
  })

  test("INV-B-GRF-03: dangling edges are ignored, not treated as prerequisites", () => {
    const corpus = corpusOf(
      [node("a"), node("b")],
      [edge("ghost", "b"), edge("a", "ghost"), edge("a", "b")],
    )
    expect(eligible(corpus, snapshotOf([["a", THRESHOLD]]))).toEqual([
      nodeId("a"),
      nodeId("b"),
    ])
    expect(eligible(corpus, new Map())).toEqual([nodeId("a")])
  })

  test("INV-C-GRF-01: Graph Live does not import Clock", async () => {
    const text = await Bun.file(new URL("./live.ts", import.meta.url)).text()
    expect(text).not.toMatch(/\bClock\b/)
    expect(text).not.toMatch(/from ["'][^"']*testing\/clock/)
  })
})
