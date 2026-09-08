import { Context, type Effect } from "effect"
import type { Brightness } from "../../domain/brightness.ts"
import type { Corpus } from "../../domain/corpus.ts"
import type { NodeId } from "../../domain/ids.ts"

/**
 * Does: snapshot + corpus → eligible nodes. A node is eligible iff every
 * prerequisite's Brightness is >= THRESHOLD. Archived trees yield no nodes.
 *
 * Does not: know the time, know what's due, import mastery or scheduler,
 * touch I/O, walk or invent FSRS state.
 *
 * Edges whose endpoints are missing from the node set are ignored.
 * TODO(forester): reject proposed edges that do not point at a real node.
 */
export class Graph extends Context.Tag("nth/Graph")<
  Graph,
  {
    readonly eligible: (
      corpus: Corpus,
      snapshot: ReadonlyMap<NodeId, Brightness>,
    ) => Effect.Effect<ReadonlyArray<NodeId>>
  }
>() {}
