import { type Clock, Context, Data, type Effect } from "effect"
import type { InboxCaptured } from "../domain/events.ts"

export class InboxError extends Data.TaggedError("InboxError")<{
  readonly reason: string
}> {}

/**
 * Inbox of raw captured text. Appends inbox.captured; lists pending entries.
 *
 * Does not: create cards, import engine Tags, compute Brightness, walk
 * trees, or prompt. Consent lives in Session CLI.
 *
 * Clock: capture lists Clock in R. Live must not construct or Layer.provide
 * a Clock — the CLI (or a test) supplies it.
 */
export class Inbox extends Context.Tag("nth/Inbox")<
  Inbox,
  {
    readonly capture: (
      text: string,
    ) => Effect.Effect<void, InboxError, Clock.Clock>
    readonly pending: () => Effect.Effect<
      ReadonlyArray<InboxCaptured>,
      InboxError
    >
  }
>() {}
