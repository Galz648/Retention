import { Schema } from "effect"
import { Outcome } from "./cards.ts"
import { CardId } from "./ids.ts"

/**
 * Events carry the time they happened as data. They never embed derived
 * values (no due date, interval, or brightness).
 *
 * Curation, retirement, must-hit accretion, and tree-archive events stay
 * parked — do not add them here.
 */
export class CardReviewed extends Schema.TaggedClass<CardReviewed>()(
  "card.reviewed",
  {
    id: CardId,
    at: Schema.DateTimeUtc,
    rating: Outcome,
  },
) {}

export class InboxCaptured extends Schema.TaggedClass<InboxCaptured>()(
  "inbox.captured",
  {
    text: Schema.String,
    at: Schema.DateTimeUtc,
  },
) {}

export const Event = Schema.Union(CardReviewed, InboxCaptured)
export type Event = typeof Event.Type
