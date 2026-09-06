import { Context, Data, Effect } from "effect"
import type { Event } from "../events/interface.ts"
import { NotImplemented } from "../events/not-implemented.ts"
import type { Record } from "../store/interface.ts"

export class SyntaxError extends Data.TaggedError("SyntaxError")<{
  readonly record: Record
  readonly cause: unknown
}> {}

export class IncompleteRecord extends Data.TaggedError("IncompleteRecord")<{
  readonly unterminated: string
}> {}

export type CodecError = SyntaxError | IncompleteRecord

export class Codec extends Context.Tag("nth/Codec")<
  Codec,
  {
    readonly encode: (event: Event) => Effect.Effect<Record, NotImplemented>
    readonly decode: (
      record: Record,
    ) => Effect.Effect<Event, CodecError | NotImplemented>
  }
>() {}
