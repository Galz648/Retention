import { Effect, Layer } from "effect"
import { THRESHOLD } from "../../config.ts"
import type { Brightness } from "../../domain/brightness.ts"
import type { Corpus } from "../../domain/corpus.ts"
import type { NodeId } from "../../domain/ids.ts"
import { Graph } from "./interface.ts"

const brightnessOrZero = (
  snapshot: ReadonlyMap<NodeId, Brightness>,
  id: NodeId,
): number => {
  const value = snapshot.get(id)
  return value === undefined ? 0 : value
}

const eligibleIds = (
  corpus: Corpus,
  snapshot: ReadonlyMap<NodeId, Brightness>,
): ReadonlyArray<NodeId> => {
  if (corpus.archived) {
    return []
  }

  const nodeIds = new Set(corpus.nodes.map((node) => node.id))
  const prereqs = new Map<NodeId, Set<NodeId>>()
  for (const id of nodeIds) {
    prereqs.set(id, new Set())
  }

  for (const edge of corpus.edges) {
    // Ignore edges whose endpoints are missing from the node set.
    // TODO(forester): when forester exists, every proposed edge must point at a real node.
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      continue
    }
    const bucket = prereqs.get(edge.to)
    if (bucket === undefined) {
      continue
    }
    bucket.add(edge.from)
  }

  const eligible: Array<NodeId> = []
  for (const id of nodeIds) {
    const deps = prereqs.get(id)
    if (deps === undefined) {
      continue
    }
    let ready = true
    for (const from of deps) {
      if (brightnessOrZero(snapshot, from) < THRESHOLD) {
        ready = false
        break
      }
    }
    if (ready) {
      eligible.push(id)
    }
  }

  return eligible.sort()
}

export const Live: Layer.Layer<Graph> = Layer.succeed(
  Graph,
  Graph.of({
    eligible: (corpus, snapshot) =>
      Effect.sync(() => eligibleIds(corpus, snapshot)),
  }),
)
