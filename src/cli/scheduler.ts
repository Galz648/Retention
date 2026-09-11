import { Effect, Schema } from "effect"
import { THRESHOLD } from "../config.ts"
import type { Card } from "../domain/cards.ts"
import { Brightness } from "../domain/brightness.ts"
import type { Corpus } from "../domain/corpus.ts"
import type { CardId } from "../domain/ids.ts"
import { Scheduler } from "../engine/scheduler/interface.ts"
import { nodeTitle } from "./cards-view.ts"

const ZERO = Schema.decodeUnknownSync(Brightness)(0)
const ONE = Schema.decodeUnknownSync(Brightness)(1)

export const zeroValues = (
  cards: ReadonlyArray<Card>,
): Map<CardId, Brightness> => new Map(cards.map((card) => [card.id, ZERO]))

export const fullValues = (
  cards: ReadonlyArray<Card>,
): Map<CardId, Brightness> => new Map(cards.map((card) => [card.id, ONE]))

const formatDue = (corpus: Corpus, card: Card): string =>
  `${nodeTitle(corpus, card.nodeId)} [${card._tag}] ${card.prompt}`

export const dueLines = (
  corpus: Corpus,
  values: ReadonlyMap<CardId, Brightness>,
): Effect.Effect<string, never, Scheduler> =>
  Effect.gen(function* () {
    const scheduler = yield* Scheduler
    const ids = yield* scheduler.due(values)
    if (ids.length === 0) return "none due"
    const byId = new Map(corpus.cards.map((card) => [card.id, card] as const))
    return ids.flatMap((id) => {
      const card = byId.get(id)
      return card === undefined ? [] : [formatDue(corpus, card)]
    }).join("\n")
  })
