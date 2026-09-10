import { DateTime, Effect, Layer, Schema } from "effect"
import * as fc from "effect/FastCheck"
import { describe, expect, test } from "bun:test"
import {
  Brightness,
  CardId,
  CardReviewed,
  DerivationCard,
  NodeId,
  RecallCard,
  type Card,
  type Event,
  type Outcome,
} from "../../domain/index.ts"
import { ClockAt } from "../../testing/clock.ts"
import { Mastery } from "./interface.ts"
import { Live } from "./live.ts"

const DAY = 86_400_000
const ORIGIN = Date.parse("2024-01-01T00:00:00.000Z")
const NOW = Date.parse("2026-03-10T12:00:00.000Z")

const cardId = (s: string): CardId => Schema.decodeUnknownSync(CardId)(s)
const nodeId = (s: string) => Schema.decodeUnknownSync(NodeId)(s)
const atMillis = (millis: number) =>
  DateTime.unsafeFromDate(new Date(millis))

const recall = (id: string): RecallCard =>
  new RecallCard({
    id: cardId(id),
    nodeId: nodeId("node-1"),
    prompt: "prompt",
    answer: "answer",
    tags: [],
  })

const derivation = (id: string): DerivationCard =>
  new DerivationCard({
    id: cardId(id),
    nodeId: nodeId("node-1"),
    prompt: "prompt",
    tags: [],
    mustHits: [],
  })

const review = (
  id: string,
  millis: number,
  rating: Outcome,
): CardReviewed =>
  new CardReviewed({
    id: cardId(id),
    at: atMillis(millis),
    rating,
  })

const evaluateSync = (
  events: ReadonlyArray<Event>,
  cards: ReadonlyArray<Card>,
  epochMillis: number,
): ReadonlyMap<CardId, Brightness> =>
  Effect.runSync(
    Effect.gen(function* () {
      const mastery = yield* Mastery
      return yield* mastery.evaluate(events, cards)
    }).pipe(Effect.provide(Layer.merge(Live, ClockAt(epochMillis)))),
  )

const unreviewed = Schema.decodeUnknownSync(Brightness)(0)

const serialize = (values: ReadonlyMap<CardId, Brightness>): string =>
  JSON.stringify(
    [...values.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  )

const outcomeArb = fc.constantFrom(
  "Again" as const,
  "Hard" as const,
  "Good" as const,
  "Easy" as const,
)

const cardSpecArb = fc.uniqueArray(
  fc.record({
    n: fc.integer({ min: 0, max: 9 }),
    kind: fc.constantFrom("recall" as const, "derivation" as const),
  }),
  { minLength: 1, maxLength: 6, selector: (spec) => spec.n },
)

const scenarioArb = fc
  .tuple(
    cardSpecArb,
    fc.array(
      fc.record({
        n: fc.integer({ min: 0, max: 12 }),
        day: fc.integer({ min: 0, max: 400 }),
        rating: outcomeArb,
      }),
      { maxLength: 16 },
    ),
    fc.integer({ min: 0, max: 500 }),
  )
  .map(([specs, reviews, nowDay]) => {
    const cards: Array<Card> = specs.map((spec) =>
      spec.kind === "recall"
        ? recall(`card-${spec.n}`)
        : derivation(`card-${spec.n}`),
    )
    const events: Array<Event> = reviews.map((item) =>
      review(`card-${item.n}`, ORIGIN + item.day * DAY, item.rating),
    )
    return { cards, events, now: ORIGIN + nowDay * DAY }
  })

describe("Mastery.Live", () => {
  test("unreviewed cards still get a Brightness", () => {
    const cards = [recall("fresh"), derivation("also-fresh")]
    const values = evaluateSync([], cards, NOW)
    expect(values.size).toBe(2)
    expect(values.get(cardId("fresh"))).toBe(unreviewed)
    expect(values.get(cardId("also-fresh"))).toBe(unreviewed)
  })

  test("INV-B-MST-01: reviews for unknown card ids are ignored", () => {
    const cards = [recall("known")]
    const events = [
      review("known", NOW - 10 * DAY, "Good"),
      review("ghost", NOW - 10 * DAY, "Easy"),
    ]
    const values = evaluateSync(events, cards, NOW)
    expect(values.size).toBe(1)
    expect(values.has(cardId("ghost"))).toBe(false)
    expect(values.has(cardId("known"))).toBe(true)
  })

  test("INV-B-MST-01: every input card has exactly one Brightness in [0, 1]", () => {
    const cards = [recall("a"), derivation("b"), recall("c")]
    const events = [
      review("a", NOW - 30 * DAY, "Good"),
      review("a", NOW - 2 * DAY, "Hard"),
      review("missing", NOW - 1 * DAY, "Easy"),
    ]
    const values = evaluateSync(events, cards, NOW)
    expect(values.size).toBe(cards.length)
    for (const card of cards) {
      const brightness = values.get(card.id)
      expect(brightness).toBeDefined()
      expect(brightness).toBeGreaterThanOrEqual(0)
      expect(brightness).toBeLessThanOrEqual(1)
    }
  })

  test("INV-B-MST-02: evaluate twice with the same log and Clock is identical", () => {
    const cards = [recall("alpha"), derivation("beta")]
    const events = [
      review("alpha", NOW - 40 * DAY, "Good"),
      review("beta", NOW - 12 * DAY, "Easy"),
      review("alpha", NOW - 3 * DAY, "Hard"),
    ]
    expect(serialize(evaluateSync(events, cards, NOW))).toBe(
      serialize(evaluateSync(events, cards, NOW)),
    )
  })

  test("Clock a year ago yields different Brightness than now for a decaying card", () => {
    const cards = [recall("decay")]
    const reviewedAt = NOW - 400 * DAY
    const events = [review("decay", reviewedAt, "Good")]
    const yearAgo = NOW - 365 * DAY
    const then = evaluateSync(events, cards, yearAgo).get(cardId("decay"))
    const now = evaluateSync(events, cards, NOW).get(cardId("decay"))
    expect(then).toBeDefined()
    expect(now).toBeDefined()
    expect(then).not.toBe(now)
  })

  test("INV-B-MST-03: Brightness is monotonic between times with no review in the open-closed interval", () => {
    const cards = [recall("mono")]
    const reviewedAt = NOW - 200 * DAY
    const events = [review("mono", reviewedAt, "Good")]
    const t1 = reviewedAt + 10 * DAY
    const t2 = reviewedAt + 80 * DAY
    const early = evaluateSync(events, cards, t1).get(cardId("mono"))
    const late = evaluateSync(events, cards, t2).get(cardId("mono"))
    expect(early).toBeDefined()
    expect(late).toBeDefined()
    if (early === undefined || late === undefined) {
      throw new Error("expected brightness for mono")
    }
    expect(late).toBeLessThanOrEqual(early)
  })

  test("INV-B-MST-04: recall decays faster than derivation after the same history", () => {
    const cards = [recall("r"), derivation("d")]
    const reviewedAt = NOW - 60 * DAY
    const events = [
      review("r", reviewedAt, "Good"),
      review("d", reviewedAt, "Good"),
    ]
    const values = evaluateSync(events, cards, NOW)
    const recallBrightness = values.get(cardId("r"))
    const derivationBrightness = values.get(cardId("d"))
    expect(recallBrightness).toBeDefined()
    expect(derivationBrightness).toBeDefined()
    if (
      recallBrightness === undefined ||
      derivationBrightness === undefined
    ) {
      throw new Error("expected brightness for both card types")
    }
    expect(recallBrightness).toBeLessThan(derivationBrightness)
  })

  test("INV-C-MST-01: live module never reads Date.now", async () => {
    const text = await Bun.file(
      new URL("./live.ts", import.meta.url),
    ).text()
    expect(text).not.toMatch(/Date\.now/)
    expect(text).not.toMatch(/Clock\.currentTimeMillis/)
  })

  test("INV-B-MST-01 INV-B-MST-02 INV-B-MST-03: random logs: determinism, coverage, bounds, monotonic decay", () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const first = evaluateSync(
          scenario.events,
          scenario.cards,
          scenario.now,
        )
        const second = evaluateSync(
          scenario.events,
          scenario.cards,
          scenario.now,
        )
        if (serialize(first) !== serialize(second)) return false
        if (first.size !== scenario.cards.length) return false
        for (const card of scenario.cards) {
          const brightness = first.get(card.id)
          if (brightness === undefined) return false
          if (brightness < 0 || brightness > 1) return false
        }
        return true
      }),
      { numRuns: 80 },
    )

    fc.assert(
      fc.property(
        scenarioArb,
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 500 }),
        (scenario, dayA, dayB) => {
          const t1 = ORIGIN + Math.min(dayA, dayB) * DAY
          const t2 = ORIGIN + Math.max(dayA, dayB) * DAY
          if (t1 === t2) return true
          const early = evaluateSync(scenario.events, scenario.cards, t1)
          const late = evaluateSync(scenario.events, scenario.cards, t2)
          for (const card of scenario.cards) {
            const reviewedInWindow = scenario.events.some((event) => {
              if (event.id !== card.id) return false
              const at = DateTime.toEpochMillis(event.at)
              return at > t1 && at <= t2
            })
            if (reviewedInWindow) continue
            const a = early.get(card.id)
            const b = late.get(card.id)
            if (a === undefined || b === undefined) return false
            if (b > a) return false
          }
          return true
        },
      ),
      { numRuns: 80 },
    )

    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const reviewed = scenario.events.filter((event) =>
          scenario.cards.some((card) => card.id === event.id),
        )
        if (reviewed.length === 0) return true
        const first = reviewed[0]
        if (first === undefined) return true
        const reviewedAt = DateTime.toEpochMillis(first.at)
        const t1 = reviewedAt + DAY
        const t2 = reviewedAt + 365 * DAY
        const hasLaterReview = reviewed.some((event) => {
          if (event.id !== first.id) return false
          const at = DateTime.toEpochMillis(event.at)
          return at > t1 && at <= t2
        })
        if (hasLaterReview) return true
        const card = scenario.cards.find((item) => item.id === first.id)
        if (card === undefined) return true
        const then = evaluateSync([first], [card], t1).get(card.id)
        const now = evaluateSync([first], [card], t2).get(card.id)
        if (then === undefined || now === undefined) return false
        return then !== now
      }),
      { numRuns: 80 },
    )
  })
})
