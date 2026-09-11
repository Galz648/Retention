import { type Clock, Effect } from "effect"
import { Codec } from "../codec/interface.ts"
import { CorpusStore } from "../corpus/interface.ts"
import type { Brightness } from "../domain/brightness.ts"
import type { Corpus } from "../domain/corpus.ts"
import type { Event } from "../domain/events.ts"
import type { CardId, TreeId } from "../domain/ids.ts"
import { Mastery } from "../engine/mastery/interface.ts"
import { SessionError } from "../session/interface.ts"
import { Store } from "../store/interface.ts"
import { nodeTitle } from "./cards-view.ts"

const fail = (reason: string): SessionError => new SessionError({ reason })

const tagged = (error: { readonly _tag: string }): SessionError =>
  fail(error._tag)

export const brightnessLines = (
  corpus: Corpus,
  values: ReadonlyMap<CardId, Brightness>,
): string =>
  corpus.cards
    .map((card) => {
      const brightness = values.get(card.id) ?? 0
      return `${nodeTitle(corpus, card.nodeId)} [${card._tag}] ${card.prompt} ${brightness}`
    })
    .join("\n")

export const evaluateTree = (
  treeId: TreeId,
): Effect.Effect<
  string,
  SessionError,
  Mastery | CorpusStore | Store | Codec | Clock.Clock
> =>
  Effect.gen(function* () {
    const corpora = yield* CorpusStore
    const store = yield* Store
    const codec = yield* Codec
    const mastery = yield* Mastery

    const corpus = yield* corpora.read(treeId).pipe(Effect.mapError(tagged))
    const snapshot = yield* store.read().pipe(
      Effect.catchTag("NotFound", () => Effect.succeed({ records: [] })),
      Effect.mapError(tagged),
    )
    if ("unterminated" in snapshot && snapshot.unterminated !== undefined) {
      return yield* Effect.fail(fail("unterminated"))
    }

    const events: Array<Event> = []
    for (const record of snapshot.records) {
      const event = yield* codec.decode(record).pipe(Effect.mapError(tagged))
      events.push(event)
    }

    const values = yield* mastery.evaluate(events, corpus.cards)
    return brightnessLines(corpus, values)
  })
