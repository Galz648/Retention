import { Schema } from "effect"
import { CardId, NodeId } from "./ids.ts"

export const Outcome = Schema.Literal("Again", "Hard", "Good", "Easy")
export type Outcome = typeof Outcome.Type

export class RecallCard extends Schema.TaggedClass<RecallCard>()("recall", {
  id: CardId,
  nodeId: NodeId,
  prompt: Schema.String,
  answer: Schema.String,
  tags: Schema.Array(Schema.String),
}) {}

export class DerivationCard extends Schema.TaggedClass<DerivationCard>()(
  "derivation",
  {
    id: CardId,
    nodeId: NodeId,
    prompt: Schema.String,
    tags: Schema.Array(Schema.String),
    mustHits: Schema.Array(Schema.String),
  },
) {}

// TODO: practice card type (decay between recall and derivation). Parked for V1.
export const Card = Schema.Union(RecallCard, DerivationCard)
export type Card = typeof Card.Type
