import { Clock, Effect, Schema } from "effect"
import { describe, expect, test } from "bun:test"
import { GapObserved } from "../domain/events.ts"
import { CardId } from "../domain/ids.ts"
import { Memory } from "../store/memory.ts"
import { Live as CodecLive } from "../codec/layers.ts"
import { ClockAt } from "../testing/clock.ts"
import { Gap } from "./interface.ts"
import { Live } from "./live.ts"

const NOW = Date.parse("2026-03-10T12:00:00.000Z")
const cardId = Schema.decodeUnknownSync(CardId)("der-diffusion")

const run = <A, E>(
  effect: Effect.Effect<A, E, Gap | Clock.Clock>,
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(Live),
      Effect.provide(Memory),
      Effect.provide(CodecLive),
      Effect.provide(ClockAt(NOW)),
    ),
  )

describe("Gap.Live", () => {
  test("INV-B-GAP-01: observe appends exactly one gap.observed and nothing else", async () => {
    const entries = await run(
      Effect.gen(function* () {
        const gap = yield* Gap
        yield* gap.observe({
          id: cardId,
          subConcept: "  concentration gradient direction  ",
          observation: "  stated low->high  ",
          severity: "core-error",
        })
        return yield* gap.pending()
      }),
    )
    expect(entries.length).toBe(1)
    const entry = entries[0]
    expect(entry).toBeInstanceOf(GapObserved)
    if (entry instanceof GapObserved) {
      expect(entry.id).toBe(cardId)
      expect(entry.subConcept).toBe("concentration gradient direction")
      expect(entry.observation).toBe("stated low->high")
      expect(entry.severity).toBe("core-error")
    }
  })

  test("INV-B-GAP-01: empty subConcept or observation is not written", async () => {
    const result = await run(
      Effect.gen(function* () {
        const gap = yield* Gap
        const blankConcept = yield* Effect.flip(
          gap.observe({
            id: cardId,
            subConcept: "   ",
            observation: "stated low->high",
            severity: "gap",
          }),
        )
        const blankObservation = yield* Effect.flip(
          gap.observe({
            id: cardId,
            subConcept: "Fick",
            observation: "  ",
            severity: "gap",
          }),
        )
        const pending = yield* gap.pending()
        return { blankConcept, blankObservation, pending }
      }),
    )
    expect(result.blankConcept.reason).toBe("empty")
    expect(result.blankObservation.reason).toBe("empty")
    expect(result.pending).toEqual([])
  })

  test("INV-B-GAP-01: pending returns observations in log order", async () => {
    const concepts = await run(
      Effect.gen(function* () {
        const gap = yield* Gap
        yield* gap.observe({
          id: cardId,
          subConcept: "first",
          observation: "missed first",
          severity: "gap",
        })
        yield* gap.observe({
          id: cardId,
          subConcept: "second",
          observation: "missed second",
          severity: "minor",
        })
        const pending = yield* gap.pending()
        return pending.map((entry) => entry.subConcept)
      }),
    )
    expect(concepts).toEqual(["first", "second"])
  })

  test("INV-C-GAP-01: gap Live does not import engine, session, cli, or THRESHOLD", async () => {
    const glob = new Bun.Glob("src/gap/**/*.ts")
    for await (const path of glob.scan(".")) {
      if (path.endsWith(".test.ts")) continue
      const text = await Bun.file(path).text()
      expect(text).not.toMatch(/from ["'][^"']*engine\//)
      expect(text).not.toMatch(/from ["'][^"']*session\//)
      expect(text).not.toMatch(/from ["'][^"']*cli\//)
      expect(text).not.toMatch(/THRESHOLD/)
      expect(text).not.toMatch(/Clock\.make\(/)
      expect(text).not.toMatch(/Layer\.succeed\(\s*Clock/)
      expect(text).not.toMatch(/Layer\.provide\(.*Clock/)
    }
  })
})
