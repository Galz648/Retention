import { Context, type DateTime, Effect } from "effect"
import type { Card, Event, InboxId } from "../events/interface.ts"

export interface OpenCapture {
  readonly id: InboxId
  readonly at: DateTime.Utc
  readonly text: string
}

export interface DueQueue {
  readonly recall: ReadonlyArray<Card>
  readonly derivation: ReadonlyArray<Card>
}

export interface State {
  readonly due: DueQueue
  readonly inbox: ReadonlyArray<OpenCapture>
  readonly history: ReadonlyArray<Event>
}

export class Scheduler extends Context.Tag("nth/Scheduler")<
  Scheduler,
  {
    readonly fold: (
      events: ReadonlyArray<Event>,
      now: DateTime.Utc,
    ) => Effect.Effect<State>
  }
>() {}
