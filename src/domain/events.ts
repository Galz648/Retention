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

export const GapSeverity = Schema.Literal("core-error", "gap", "minor")
export type GapSeverity = typeof GapSeverity.Type

export const GapSuggests = Schema.Union(
  Schema.Struct({ prereqNode: Schema.String }),
  Schema.Struct({ subNodeUnder: Schema.String }),
)
export type GapSuggests = typeof GapSuggests.Type

export class GapObserved extends Schema.TaggedClass<GapObserved>()(
  "gap.observed",
  {
    id: CardId,
    at: Schema.DateTimeUtc,
    subConcept: Schema.String,
    observation: Schema.String,
    severity: GapSeverity,
    suggests: Schema.optional(GapSuggests),
    held: Schema.optional(Schema.Array(Schema.String)),
  },
) {}

export const Event = Schema.Union(CardReviewed, InboxCaptured, GapObserved)
export type Event = typeof Event.Type
