import { Context, type DateTime, Effect } from "effect"
import type { Card, CardId, Event, Outcome } from "../events/interface.ts"
import { NotImplemented } from "../events/not-implemented.ts"
import type { DueQueue, OpenCapture } from "../scheduler/interface.ts"

export class Core extends Context.Tag("nth/Core")<
  Core,
  {
    readonly due: (
      now: DateTime.Utc,
    ) => Effect.Effect<DueQueue, NotImplemented>
    readonly record: (
      cardId: CardId,
      outcome: Outcome,
      now: DateTime.Utc,
    ) => Effect.Effect<void, NotImplemented>
    readonly add: (card: Card) => Effect.Effect<void, NotImplemented>
    readonly capture: (
      text: string,
      now: DateTime.Utc,
    ) => Effect.Effect<void, NotImplemented>
    readonly inbox: () => Effect.Effect<
      ReadonlyArray<OpenCapture>,
      NotImplemented
    >
    readonly history: () => Effect.Effect<
      ReadonlyArray<Event>,
      NotImplemented
    >
  }
>() {}
