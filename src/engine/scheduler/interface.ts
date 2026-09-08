import { Context, type Effect } from "effect"
import type { Brightness } from "../../domain/brightness.ts"
import type { CardId } from "../../domain/ids.ts"

/**
 * Does: Brightness map + THRESHOLD → due card ids (Brightness < THRESHOLD).
 * Deterministic order (sort by CardId).
 *
 * Does not: know dependencies, card types, or the clock. Does not import
 * mastery or graph. Does not read THRESHOLD as a magic literal — import
 * it from src/config.ts.
 */
export class Scheduler extends Context.Tag("nth/Scheduler")<
  Scheduler,
  {
    readonly due: (
      values: ReadonlyMap<CardId, Brightness>,
    ) => Effect.Effect<ReadonlyArray<CardId>>
  }
>() {}
