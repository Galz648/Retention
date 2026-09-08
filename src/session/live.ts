import { Clock, DateTime, Effect, Layer, Schema } from "effect"
import { Codec } from "../codec/interface.ts"
import { CorpusStore } from "../corpus/interface.ts"
import { Brightness } from "../domain/brightness.ts"
import type { Card, Outcome } from "../domain/cards.ts"
import type { Corpus } from "../domain/corpus.ts"
import { CardReviewed, type Event } from "../domain/events.ts"
import type { CardId, NodeId, TreeId } from "../domain/ids.ts"
import { Graph } from "../engine/graph/interface.ts"
import { Mastery } from "../engine/mastery/interface.ts"
import { Scheduler } from "../engine/scheduler/interface.ts"
import { Store } from "../store/interface.ts"
import { Session, SessionError } from "./interface.ts"

const asBrightness = (value: number): Brightness =>
  Schema.decodeUnknownSync(Brightness)(Math.min(1, Math.max(0, value)))

/**
 * TODO: node Brightness fold. Min of the node's cards is a placeholder —
 * not a claim about how a concept is known. Session must not walk edges.
 */
const nodeSnapshot = (
  corpus: Corpus,
  values: ReadonlyMap<CardId, Brightness>,
): ReadonlyMap<NodeId, Brightness> => {
  const snapshot = new Map<NodeId, Brightness>()
  for (const node of corpus.nodes) {
    let min: number | undefined
    for (const cardId of node.cardIds) {
      const brightness = values.get(cardId)
      if (brightness === undefined) continue
      min = min === undefined ? brightness : Math.min(min, brightness)
    }
    snapshot.set(node.id, asBrightness(min ?? 0))
  }
  return snapshot
}

const byPresentation = (left: Card, right: Card): number => {
  if (left._tag !== right._tag) {
    return left._tag === "recall" ? -1 : 1
  }
  if (left.id < right.id) return -1
  if (left.id > right.id) return 1
  return 0
}

const fail = (reason: string): SessionError => new SessionError({ reason })

const tagged = (error: { readonly _tag: string }): SessionError =>
  fail(error._tag)

export const Live = (
  treeId: TreeId,
): Layer.Layer<
  Session,
  never,
  Store | Codec | CorpusStore | Mastery | Graph | Scheduler
> =>
  Layer.effect(
    Session,
    Effect.gen(function* () {
      const store = yield* Store
      const codec = yield* Codec
      const corpora = yield* CorpusStore
      const mastery = yield* Mastery
      const graph = yield* Graph
      const scheduler = yield* Scheduler

      const loadEvents = Effect.gen(function* () {
        const snapshot = yield* store.read().pipe(Effect.mapError(tagged))
        if ("unterminated" in snapshot && snapshot.unterminated !== undefined) {
          return yield* Effect.fail(fail("unterminated"))
        }
        const events: Array<Event> = []
        for (const record of snapshot.records) {
          const event = yield* codec.decode(record).pipe(Effect.mapError(tagged))
          events.push(event)
        }
        return events
      })

      return Session.of({
        queue: () =>
          Effect.gen(function* () {
            const corpus = yield* corpora.read(treeId).pipe(Effect.mapError(tagged))
            const events = yield* loadEvents
            const values = yield* mastery.evaluate(events, corpus.cards)
            const due = yield* scheduler.due(values)
            const eligible = yield* graph.eligible(
              corpus,
              nodeSnapshot(corpus, values),
            )
            const dueSet = new Set(due)
            const eligibleSet = new Set(eligible)
            return corpus.cards
              .filter(
                (card) => dueSet.has(card.id) && eligibleSet.has(card.nodeId),
              )
              .slice()
              .sort(byPresentation)
          }),
        grade: (cardId, rating: Outcome) =>
          Effect.gen(function* () {
            const corpus = yield* corpora.read(treeId).pipe(Effect.mapError(tagged))
            const known = corpus.cards.some((card) => card.id === cardId)
            if (!known) {
              return yield* Effect.fail(fail("unknown-card"))
            }
            const clock = yield* Clock.Clock
            const nowMillis = yield* clock.currentTimeMillis
            const event = new CardReviewed({
              id: cardId,
              at: DateTime.unsafeFromDate(new Date(nowMillis)),
              rating,
            })
            const record = yield* codec.encode(event)
            yield* store.append(record).pipe(Effect.mapError(tagged))
          }),
      })
    }),
  )
