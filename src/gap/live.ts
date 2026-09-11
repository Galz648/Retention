import { Clock, DateTime, Effect, Layer } from "effect"
import { Codec } from "../codec/interface.ts"
import { GapObserved, type Event } from "../domain/events.ts"
import { Store } from "../store/interface.ts"
import { Gap, GapError } from "./interface.ts"

const fail = (reason: string): GapError => new GapError({ reason })

const tagged = (error: { readonly _tag: string }): GapError =>
  fail(error._tag)

export const Live: Layer.Layer<Gap, never, Store | Codec> = Layer.effect(
  Gap,
  Effect.gen(function* () {
    const store = yield* Store
    const codec = yield* Codec

    const loadEvents = Effect.gen(function* () {
      const snapshot = yield* store.read().pipe(Effect.mapError(tagged))
      if ("unterminated" in snapshot && snapshot.unterminated !== undefined) {
        return yield* Effect.fail(fail("unterminated"))
      }
      const events: Array<Event> = []
      for (const record of snapshot.records) {
        const event = yield* codec.decode(record).pipe(Effect.mapError(tagged))
        events.push(event)
      }
      return events
    })

    return Gap.of({
      observe: (input) =>
        Effect.gen(function* () {
          const subConcept = input.subConcept.trim()
          const observation = input.observation.trim()
          if (subConcept.length === 0 || observation.length === 0) {
            return yield* Effect.fail(fail("empty"))
          }
          const clock = yield* Clock.Clock
          const nowMillis = yield* clock.currentTimeMillis
          const event = new GapObserved({
            id: input.id,
            at: DateTime.unsafeFromDate(new Date(nowMillis)),
            subConcept,
            observation,
            severity: input.severity,
            ...(input.suggests === undefined ? {} : { suggests: input.suggests }),
            ...(input.held === undefined ? {} : { held: [...input.held] }),
          })
          const record = yield* codec.encode(event)
          yield* store.append(record).pipe(Effect.mapError(tagged))
        }),
      pending: () =>
        Effect.gen(function* () {
          const events = yield* loadEvents
          return events.filter(
            (event): event is GapObserved => event._tag === "gap.observed",
          )
        }),
    })
  }),
)
