import { Clock, Context, type Effect } from "effect"
import type { Brightness } from "../../domain/brightness.ts"
import type { Card } from "../../domain/cards.ts"
import type { Event } from "../../domain/events.ts"
import type { CardId } from "../../domain/ids.ts"

/**
 * Does: log + card type + Clock → one Brightness per card in [0, 1].
 * The only time-aware engine component. Uses FSRS internally; discards
 * FSRS due dates; emits Brightness.
 *
 * Does not: pick cards, check prerequisites, read a clock other than Clock,
 * provide Clock, import graph or scheduler, touch I/O.
 *
 * `evaluate` must list Clock in R (`yield* Clock.Clock`). Never call
 * `Clock.currentTimeMillis` (hides the dependency). Live must not Layer.provide
 * any Clock.
 */
export class Mastery extends Context.Tag("nth/Mastery")<
  Mastery,
  {
    readonly evaluate: (
      events: ReadonlyArray<Event>,
      cards: ReadonlyArray<Card>,
    ) => Effect.Effect<ReadonlyMap<CardId, Brightness>, never, Clock.Clock>
  }
>() {}
