import { type Clock, Context, Data, type Effect } from "effect"
import type { Card, Outcome } from "../domain/cards.ts"
import type { CardId, TreeId } from "../domain/ids.ts"

export class SessionError extends Data.TaggedError("SessionError")<{
  readonly reason: string
}> {}

/**
 * Impure composition. Reads stores, runs the engine, appends review events.
 *
 * Does not: compute Brightness, decide due-ness, walk prerequisites, or
 * create nodes. Intersects scheduler due-ids with graph-eligible nodes.
 *
 * Clock: this layer depends on Clock and forwards it to mastery. It must
 * not construct or Layer.provide a Clock — the CLI (or a test) supplies it.
 *
 * Each call names the tree. The layer is not glued to one tree at startup.
 *
 * grade appends exactly one CardReviewed and nothing else.
 */
export class Session extends Context.Tag("nth/Session")<
  Session,
  {
    readonly queue: (
      treeId: TreeId,
    ) => Effect.Effect<ReadonlyArray<Card>, SessionError, Clock.Clock>
    readonly grade: (
      treeId: TreeId,
      cardId: CardId,
      rating: Outcome,
    ) => Effect.Effect<void, SessionError, Clock.Clock>
  }
>() {}
