import { type Clock, Context, Data, type Effect } from "effect"
import type { GapObserved, GapSeverity, GapSuggests } from "../domain/events.ts"
import type { CardId } from "../domain/ids.ts"

export class GapError extends Data.TaggedError("GapError")<{
  readonly reason: string
}> {}

export type GapObserve = {
  readonly id: CardId
  readonly subConcept: string
  readonly observation: string
  readonly severity: GapSeverity
  readonly suggests?: GapSuggests
  readonly held?: ReadonlyArray<string>
}

/**
 * Gap signal of sub-concept misses on a derivation. Appends gap.observed;
 * lists pending entries.
 *
 * Does not: create cards, import engine Tags, compute Brightness, walk
 * trees, prompt, or spawn nodes. Consent lives in Session CLI.
 *
 * Clock: observe lists Clock in R. Live must not construct or Layer.provide
 * a Clock — the CLI (or a test) supplies it.
 */
export class Gap extends Context.Tag("nth/Gap")<
  Gap,
  {
    readonly observe: (
      input: GapObserve,
    ) => Effect.Effect<void, GapError, Clock.Clock>
    readonly pending: () => Effect.Effect<
      ReadonlyArray<GapObserved>,
      GapError
    >
  }
>() {}
