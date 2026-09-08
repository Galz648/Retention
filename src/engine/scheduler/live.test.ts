import { Effect, Schema } from "effect"
import * as fc from "effect/FastCheck"
import { describe, expect, test } from "bun:test"
import { THRESHOLD } from "../../config.ts"
import { Brightness } from "../../domain/brightness.ts"
import { CardId } from "../../domain/ids.ts"
import { Scheduler } from "./interface.ts"
import { Live } from "./live.ts"

const asCardId = (s: string): CardId => Schema.decodeUnknownSync(CardId)(s)
const asBrightness = (n: number): Brightness =>
  Schema.decodeUnknownSync(Brightness)(n)

const due = (
  values: ReadonlyMap<CardId, Brightness>,
): Promise<ReadonlyArray<CardId>> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const scheduler = yield* Scheduler
      return yield* scheduler.due(values)
    }).pipe(Effect.provide(Live)),
  )

const cardIdArb = fc.string({ minLength: 1, maxLength: 24 }).map(asCardId)

const belowArb = fc
  .double({ min: 0, max: THRESHOLD, maxExcluded: true, noNaN: true })
  .map(asBrightness)
const atArb = fc.constant(asBrightness(THRESHOLD))
const aboveArb = fc
  .double({ min: THRESHOLD, minExcluded: true, max: 1, noNaN: true })
  .map(asBrightness)

const classifiedArb = fc
  .uniqueArray(
    fc.oneof(
      fc.tuple(cardIdArb, belowArb, fc.constant("below" as const)),
      fc.tuple(cardIdArb, atArb, fc.constant("at" as const)),
      fc.tuple(cardIdArb, aboveArb, fc.constant("above" as const)),
    ),
    { selector: ([id]) => id, maxLength: 20 },
  )
  .map((entries) => {
    const values = new Map<CardId, Brightness>()
    const below: Array<CardId> = []
    const at: Array<CardId> = []
    const above: Array<CardId> = []
    for (const [id, brightness, bucket] of entries) {
      values.set(id, brightness)
      if (bucket === "below") below.push(id)
      else if (bucket === "at") at.push(id)
      else above.push(id)
    }
    return { values, below, at, above }
  })

const entriesArb = fc.uniqueArray(
  fc.tuple(
    cardIdArb,
    fc.double({ min: 0, max: 1, noNaN: true }).map(asBrightness),
  ),
  { selector: ([id]) => id, maxLength: 20 },
)

describe("Scheduler.Live", () => {
  test("returns every sub-threshold card and only those cards", async () => {
    await fc.assert(
      fc.asyncProperty(classifiedArb, async ({ values, below, at, above }) => {
        const result = await due(values)
        expect(result.length).toBe(below.length)
        for (const id of below) {
          expect(result).toContain(id)
        }
        for (const id of at) {
          expect(result).not.toContain(id)
        }
        for (const id of above) {
          expect(result).not.toContain(id)
        }
      }),
    )
  })

  test("cards at exactly THRESHOLD are not due", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(cardIdArb, { minLength: 1, maxLength: 12 }),
        async (ids) => {
          const values = new Map(
            ids.map((id) => [id, asBrightness(THRESHOLD)] as const),
          )
          expect(await due(values)).toEqual([])
        },
      ),
    )
  })

  test("same Map always yields the same ids in sorted CardId order", async () => {
    const known = new Map<CardId, Brightness>([
      [asCardId("c"), asBrightness(0)],
      [asCardId("a"), asBrightness(0)],
      [asCardId("b"), asBrightness(1)],
    ])
    const first = await due(known)
    const second = await due(known)
    expect(first).toEqual([asCardId("a"), asCardId("c")])
    expect(first).toEqual(second)

    await fc.assert(
      fc.asyncProperty(
        entriesArb.chain((entries) =>
          fc.tuple(
            fc.constant(entries),
            fc.shuffledSubarray(entries, {
              minLength: entries.length,
              maxLength: entries.length,
            }),
          ),
        ),
        async ([forward, shuffled]) => {
          const once = await due(new Map(forward))
          const twice = await due(new Map(forward))
          const reordered = await due(new Map(shuffled))
          expect(once).toEqual(twice)
          expect(once).toEqual(reordered)
          expect(once).toEqual([...once].sort())
        },
      ),
    )
  })

  test("Live source is blind to card type, edges, and Clock", async () => {
    const text = await Bun.file(new URL("./live.ts", import.meta.url)).text()
    expect(text).not.toMatch(/recall/i)
    expect(text).not.toMatch(/derivation/i)
    expect(text).not.toMatch(/edges/i)
    expect(text).not.toMatch(/Clock/)
    expect(text).not.toMatch(/0\.9/)
  })
})
