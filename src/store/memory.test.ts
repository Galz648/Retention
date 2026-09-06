import { Effect, Schema } from "effect"
import { describe, expect, test } from "bun:test"
import { Record, Store } from "./interface.ts"
import { Memory } from "./memory.ts"

const record = (s: string): Record => Schema.decodeUnknownSync(Record)(s)

const withMemory = <A, E>(effect: Effect.Effect<A, E, Store>) =>
  Effect.runPromise(effect.pipe(Effect.provide(Memory)))

describe("Store.Memory", () => {
  test("missing history is empty, not an error", async () => {
    const state = await withMemory(
      Effect.gen(function* () {
        const store = yield* Store
        return yield* store.read()
      }),
    )
    expect(state.records).toEqual([])
    expect("unterminated" in state).toBe(false)
  })

  test("appends opaque records in order and never parses them", async () => {
    const a = record("{not json")
    const b = record("42")
    const state = await withMemory(
      Effect.gen(function* () {
        const store = yield* Store
        yield* store.append(a)
        yield* store.append(b)
        return yield* store.read()
      }),
    )
    expect(state.records).toEqual([a, b])
  })
})
