import { Clock, DateTime, Effect, Layer } from "effect"
import { Codec } from "../codec/interface.ts"
import { InboxCaptured, type Event } from "../domain/events.ts"
import { Store } from "../store/interface.ts"
import { Inbox, InboxError } from "./interface.ts"

const fail = (reason: string): InboxError => new InboxError({ reason })

const tagged = (error: { readonly _tag: string }): InboxError =>
  fail(error._tag)

export const Live: Layer.Layer<Inbox, never, Store | Codec> = Layer.effect(
  Inbox,
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

    return Inbox.of({
      capture: (text) =>
        Effect.gen(function* () {
          const trimmed = text.trim()
          if (trimmed.length === 0) {
            return yield* Effect.fail(fail("empty"))
          }
          const clock = yield* Clock.Clock
          const nowMillis = yield* clock.currentTimeMillis
          const event = new InboxCaptured({
            text: trimmed,
            at: DateTime.unsafeFromDate(new Date(nowMillis)),
          })
          const record = yield* codec.encode(event)
          yield* store.append(record).pipe(Effect.mapError(tagged))
        }),
      pending: () =>
        Effect.gen(function* () {
          const events = yield* loadEvents
          return events.filter(
            (event): event is InboxCaptured => event._tag === "inbox.captured",
          )
        }),
    })
  }),
)
