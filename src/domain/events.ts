import { Schema } from "effect"
import { Outcome } from "./cards.ts"
import { CardId } from "./ids.ts"

/**
 * V1 log is review facts only. Capture, curation, retirement, must-hit
 * accretion, and tree-archive events are parked — do not add them here.
 *
 * Events carry the time they happened as data. They never embed derived
 * values (no due date, interval, or brightness).
 */
export class CardReviewed extends Schema.TaggedClass<CardReviewed>()(
  "card.reviewed",
  {
    id: CardId,
    at: Schema.DateTimeUtc,
    rating: Outcome,
  },
) {}

export const Event = Schema.Union(CardReviewed)
export type Event = typeof Event.Type
