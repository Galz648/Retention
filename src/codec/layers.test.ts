import { DateTime, Effect, Schema } from "effect"
import { describe, expect, test } from "bun:test"
import { CardId, CardReviewed, type Event } from "../events/interface.ts"
import { Record } from "../store/interface.ts"
import { Codec } from "./interface.ts"
import { Live } from "./layers.ts"

const record = (s: string): Record => Schema.decodeUnknownSync(Record)(s)
const cardId = (s: string) => Schema.decodeUnknownSync(CardId)(s)
const at = DateTime.unsafeFromDate(new Date("2026-03-10T12:00:00.000Z"))

const withCodec = <A, E>(effect: Effect.Effect<A, E, Codec>) =>
  Effect.runPromise(effect.pipe(Effect.provide(Live)))

const failCodec = <E>(effect: Effect.Effect<unknown, E, Codec>) =>
  withCodec(Effect.flip(effect))

describe("Codec.Live", () => {
  test("round-trips a review event; payload has no derived fields", async () => {
    const events: ReadonlyArray<Event> = [
      new CardReviewed({ id: cardId("card-1"), at, rating: "Good" }),
    ]
    for (const event of events) {
      const decoded = await withCodec(
        Effect.gen(function* () {
          const codec = yield* Codec
          const encoded = yield* codec.encode(event)
          return yield* codec.decode(encoded)
        }),
      )
      expect(decoded).toEqual(event)
    }
    const first = events[0]
    if (first === undefined) {
      throw new Error("expected a review event")
    }
    const encoded = await withCodec(
      Effect.gen(function* () {
        const codec = yield* Codec
        return yield* codec.encode(first)
      }),
    )
    expect(typeof encoded).toBe("string")
    expect(() => JSON.parse(encoded)).not.toThrow()
    expect(JSON.parse(encoded)).not.toHaveProperty("due")
    expect(JSON.parse(encoded)).not.toHaveProperty("interval")
    expect(JSON.parse(encoded)).not.toHaveProperty("brightness")
  })

  test("complete junk line is SyntaxError, not a store error", async () => {
    await expect(
      failCodec(
        Effect.gen(function* () {
          const codec = yield* Codec
          return yield* codec.decode(record("not json"))
        }),
      ),
    ).resolves.toMatchObject({ _tag: "SyntaxError" })
  })

  test("blank line is SyntaxError", async () => {
    await expect(
      failCodec(
        Effect.gen(function* () {
          const codec = yield* Codec
          return yield* codec.decode(record(""))
        }),
      ),
    ).resolves.toMatchObject({ _tag: "SyntaxError" })
  })

  test("truncated JSON is IncompleteRecord", async () => {
    await expect(
      failCodec(
        Effect.gen(function* () {
          const codec = yield* Codec
          return yield* codec.decode(record("{\"torn\":"))
        }),
      ),
    ).resolves.toMatchObject({
      _tag: "IncompleteRecord",
      unterminated: "{\"torn\":",
    })
  })

  test("valid JSON that is not an event is InvalidEvent", async () => {
    await expect(
      failCodec(
        Effect.gen(function* () {
          const codec = yield* Codec
          return yield* codec.decode(record("null"))
        }),
      ),
    ).resolves.toMatchObject({ _tag: "InvalidEvent" })
  })
})
