import { Clock, DateTime, Effect, Layer, Schema } from "effect"
import {
  Rating,
  createEmptyCard,
  default_w,
  fsrs,
  type Grade,
} from "ts-fsrs"
import { Brightness } from "../../domain/brightness.ts"
import type { Card, Outcome } from "../../domain/cards.ts"
import type { Event } from "../../domain/events.ts"
import type { CardId } from "../../domain/ids.ts"
import { Mastery } from "./interface.ts"

const MS_PER_DAY = 86_400_000

/**
 * TODO: tune these FSRS `w` sets. Recall must fade faster than derivation.
 * w[0]..w[3] are initial stabilities for Again/Hard/Good/Easy.
 * TODO: practice cards would need a third set (decay between recall and derivation).
 */
const RECALL_INITIAL_STABILITY_SCALE = 0.4
const DERIVATION_INITIAL_STABILITY_SCALE = 2.5

const scaledW = (initialStabilityScale: number): Array<number> => {
  const w = [...default_w]
  for (let i = 0; i < 4; i++) {
    const base = w[i]
    if (base === undefined) continue
    w[i] = base * initialStabilityScale
  }
  return w
}

const recallFsrs = fsrs({
  enable_fuzz: false,
  enable_short_term: false,
  w: scaledW(RECALL_INITIAL_STABILITY_SCALE),
})

const derivationFsrs = fsrs({
  enable_fuzz: false,
  enable_short_term: false,
  w: scaledW(DERIVATION_INITIAL_STABILITY_SCALE),
})

const schedulerFor = (card: Card) => {
  switch (card._tag) {
    case "recall":
      return recallFsrs
    case "derivation":
      return derivationFsrs
  }
}

const gradeOf = (rating: Outcome): Grade => {
  switch (rating) {
    case "Again":
      return Rating.Again
    case "Hard":
      return Rating.Hard
    case "Good":
      return Rating.Good
    case "Easy":
      return Rating.Easy
  }
}

const clampUnitInterval = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

const asBrightness = (value: number): Brightness =>
  Schema.decodeUnknownSync(Brightness)(clampUnitInterval(value))

const brightnessOf = (
  card: Card,
  events: ReadonlyArray<Event>,
  nowMillis: number,
): Brightness => {
  const scheduler = schedulerFor(card)
  const reviews = events
    .filter((event) => event.id === card.id)
    .map((event) => ({
      at: DateTime.toEpochMillis(event.at),
      grade: gradeOf(event.rating),
    }))
    .filter((event) => event.at <= nowMillis)
    .sort((a, b) => a.at - b.at)

  let fsrsCard = createEmptyCard(nowMillis)
  for (const review of reviews) {
    fsrsCard = scheduler.next(fsrsCard, review.at, review.grade).card
  }

  const last = reviews[reviews.length - 1]
  if (last === undefined) {
    return asBrightness(0)
  }

  const elapsedDays = Math.max(0, (nowMillis - last.at) / MS_PER_DAY)
  return asBrightness(
    scheduler.forgetting_curve(elapsedDays, fsrsCard.stability),
  )
}

export const Live: Layer.Layer<Mastery> = Layer.succeed(
  Mastery,
  Mastery.of({
    evaluate: (events, cards) =>
      Effect.gen(function* () {
        const clock = yield* Clock.Clock
        const nowMillis = yield* clock.currentTimeMillis
        const values = new Map<CardId, Brightness>()
        for (const card of cards) {
          values.set(card.id, brightnessOf(card, events, nowMillis))
        }
        return values
      }),
  }),
)
