import { Clock, Effect } from "effect"
import { describe, expect, test } from "bun:test"
import { Live as CodecLive } from "../codec/layers.ts"
import { InboxCaptured } from "../domain/events.ts"
import { Memory } from "../store/memory.ts"
import { ClockAt } from "../testing/clock.ts"
import { Inbox } from "./interface.ts"
import { Live } from "./live.ts"

const NOW = Date.parse("2026-03-10T12:00:00.000Z")

const run = <A, E>(
  effect: Effect.Effect<A, E, Inbox | Clock.Clock>,
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(Live),
      Effect.provide(Memory),
      Effect.provide(CodecLive),
      Effect.provide(ClockAt(NOW)),
    ),
  )

describe("Inbox.Live", () => {
  test("INV-B-INB-01: capture appends exactly one inbox.captured and nothing else", async () => {
    const entries = await run(
      Effect.gen(function* () {
        const inbox = yield* Inbox
        yield* inbox.capture("  diffusion is net flow  ")
        return yield* inbox.pending()
      }),
    )
    expect(entries.length).toBe(1)
    const entry = entries[0]
    expect(entry).toBeInstanceOf(InboxCaptured)
    if (entry instanceof InboxCaptured) {
      expect(entry.text).toBe("diffusion is net flow")
    }
  })

  test("INV-B-INB-01: empty text is not written", async () => {
    const result = await run(
      Effect.gen(function* () {
        const inbox = yield* Inbox
        const flipped = yield* Effect.flip(inbox.capture("   "))
        const pending = yield* inbox.pending()
        return { flipped, pending }
      }),
    )
    expect(result.flipped.reason).toBe("empty")
    expect(result.pending).toEqual([])
  })

  test("INV-B-INB-01: pending returns captures in log order", async () => {
    const texts = await run(
      Effect.gen(function* () {
        const inbox = yield* Inbox
        yield* inbox.capture("first")
        yield* inbox.capture("second")
        const pending = yield* inbox.pending()
        return pending.map((entry) => entry.text)
      }),
    )
    expect(texts).toEqual(["first", "second"])
  })

  test("INV-C-INB-01: inbox Live does not import engine, session, cli, or THRESHOLD", async () => {
    const glob = new Bun.Glob("src/inbox/**/*.ts")
    for await (const path of glob.scan(".")) {
      if (path.endsWith(".test.ts")) continue
      const text = await Bun.file(path).text()
      expect(text).not.toMatch(/from ["'][^"']*engine\//)
      expect(text).not.toMatch(/from ["'][^"']*session\//)
      expect(text).not.toMatch(/from ["'][^"']*cli\//)
      expect(text).not.toMatch(/THRESHOLD/)
    }
  })
})
