import { Effect, Schema } from "effect"
import { THRESHOLD } from "../config.ts"
import { Brightness } from "../domain/brightness.ts"
import type { Corpus } from "../domain/corpus.ts"
import type { NodeId } from "../domain/ids.ts"
import { Graph } from "../engine/graph/interface.ts"

const asBrightness = (value: number): Brightness =>
  Schema.decodeUnknownSync(Brightness)(value)

const ZERO = asBrightness(0)
const ONE = asBrightness(1)

export const zeroSnapshot = (corpus: Corpus): Map<NodeId, Brightness> =>
  new Map(corpus.nodes.map((node) => [node.id, ZERO]))

export const fullSnapshot = (corpus: Corpus): Map<NodeId, Brightness> =>
  new Map(corpus.nodes.map((node) => [node.id, ONE]))

const titleOf = (corpus: Corpus, id: NodeId): string => {
  const node = corpus.nodes.find((item) => item.id === id)
  return node === undefined ? "unknown node" : node.title
}

const brightnessOrZero = (
  snapshot: ReadonlyMap<NodeId, Brightness>,
  id: NodeId,
): number => {
  const value = snapshot.get(id)
  return value === undefined ? 0 : value
}

const blockingTitles = (
  corpus: Corpus,
  snapshot: ReadonlyMap<NodeId, Brightness>,
  nodeId: NodeId,
): ReadonlyArray<string> => {
  const nodeIds = new Set(corpus.nodes.map((node) => node.id))
  const titles: Array<string> = []
  const seen = new Set<string>()
  for (const edge of corpus.edges) {
    if (edge.to !== nodeId) continue
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue
    if (brightnessOrZero(snapshot, edge.from) >= THRESHOLD) continue
    const title = titleOf(corpus, edge.from)
    if (seen.has(title)) continue
    seen.add(title)
    titles.push(title)
  }
  return titles
}

export const eligibleLines = (
  corpus: Corpus,
  snapshot: ReadonlyMap<NodeId, Brightness>,
): Effect.Effect<string, never, Graph> =>
  Effect.gen(function* () {
    const graph = yield* Graph
    const eligible = yield* graph.eligible(corpus, snapshot)
    const eligibleSet = new Set(eligible)
    const lines: Array<string> = ["Eligible"]
    for (const node of corpus.nodes) {
      if (eligibleSet.has(node.id)) lines.push(`  ${node.title}`)
    }
    const blocked = corpus.nodes.filter((node) => !eligibleSet.has(node.id))
    if (blocked.length === 0) return lines.join("\n")
    lines.push("")
    lines.push("Blocked")
    for (const node of blocked) {
      const needs = blockingTitles(corpus, snapshot, node.id)
      lines.push(
        needs.length === 0
          ? `  ${node.title}`
          : `  ${node.title} — needs ${needs.join(", ")}`,
      )
    }
    return lines.join("\n")
  })
