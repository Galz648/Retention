import { Schema } from "effect"

export const CardId = Schema.String.pipe(Schema.brand("CardId"))
export type CardId = typeof CardId.Type

export const InboxId = Schema.String.pipe(Schema.brand("InboxId"))
export type InboxId = typeof InboxId.Type

export const Outcome = Schema.Literal("Again", "Hard", "Good", "Easy")
export type Outcome = typeof Outcome.Type

export class RecallCard extends Schema.TaggedClass<RecallCard>()("recall", {
  id: CardId,
  prompt: Schema.String,
  answer: Schema.String,
  tags: Schema.Array(Schema.String),
}) {}

export class DerivationCard extends Schema.TaggedClass<DerivationCard>()(
  "derivation",
  {
    id: CardId,
    prompt: Schema.String,
    tags: Schema.Array(Schema.String),
    mustHits: Schema.Array(Schema.String),
  },
) {}

export const Card = Schema.Union(RecallCard, DerivationCard)
export type Card = typeof Card.Type

export class InboxCaptured extends Schema.TaggedClass<InboxCaptured>()(
  "inbox.captured",
  {
    id: InboxId,
    at: Schema.DateTimeUtc,
    text: Schema.String,
  },
) {}

export class InboxDiscarded extends Schema.TaggedClass<InboxDiscarded>()(
  "inbox.discarded",
  {
    id: InboxId,
    at: Schema.DateTimeUtc,
    reason: Schema.String,
  },
) {}

export class InboxPromoted extends Schema.TaggedClass<InboxPromoted>()(
  "inbox.promoted",
  {
    id: InboxId,
    at: Schema.DateTimeUtc,
    cardId: CardId,
  },
) {}

export class CardCreated extends Schema.TaggedClass<CardCreated>()(
  "card.created",
  {
    id: CardId,
    at: Schema.DateTimeUtc,
    origin: Schema.String,
    card: Card,
  },
) {}

export class CardReviewed extends Schema.TaggedClass<CardReviewed>()(
  "card.reviewed",
  {
    id: CardId,
    at: Schema.DateTimeUtc,
    rating: Outcome,
  },
) {}

export class CardMustHitAdded extends Schema.TaggedClass<CardMustHitAdded>()(
  "card.mustHitAdded",
  {
    id: CardId,
    at: Schema.DateTimeUtc,
    mustHit: Schema.String,
    exposedBy: Schema.String,
  },
) {}

export class CardRetired extends Schema.TaggedClass<CardRetired>()(
  "card.retired",
  {
    id: CardId,
    at: Schema.DateTimeUtc,
    reason: Schema.String,
  },
) {}

export const Event = Schema.Union(
  InboxCaptured,
  InboxDiscarded,
  InboxPromoted,
  CardCreated,
  CardReviewed,
  CardMustHitAdded,
  CardRetired,
)
export type Event = typeof Event.Type
