import { type Clock, Effect, Schema } from "effect"
import { type Card, Outcome } from "../domain/cards.ts"
import { CardId } from "../domain/ids.ts"
import { Session, SessionError } from "../session/interface.ts"

const parseCardId = (value: string) =>
  Schema.decodeUnknown(CardId)(value).pipe(
    Effect.mapError(() => new SessionError({ reason: "invalid-card-id" })),
  )

const parseOutcome = (value: string) =>
  Schema.decodeUnknown(Outcome)(value).pipe(
    Effect.mapError(() => new SessionError({ reason: "invalid-rating" })),
  )

export const formatCard = (card: Card): string => {
  if (card._tag === "recall") {
    return `[recall] ${card.id}\n${card.prompt}`
  }
  return `[derivation] ${card.id}\n${card.prompt}\nmust-hits: ${card.mustHits.join("; ")}`
}

const usage = `usage:
  queue
  grade <cardId> <Again|Hard|Good|Easy>`

export const handle = (
  args: ReadonlyArray<string>,
  write: (line: string) => void,
): Effect.Effect<void, SessionError, Session | Clock.Clock> =>
  Effect.gen(function* () {
    const session = yield* Session
    const command = args[0] ?? "queue"
    if (command === "queue") {
      const cards = yield* session.queue()
      if (cards.length === 0) {
        write("queue empty")
        return yield* Effect.void
      }
      for (const card of cards) {
        write(formatCard(card))
      }
      return yield* Effect.void
    }
    if (command === "grade") {
      const id = args[1]
      const rating = args[2]
      if (id === undefined || rating === undefined) {
        return yield* Effect.fail(new SessionError({ reason: usage }))
      }
      yield* session.grade(yield* parseCardId(id), yield* parseOutcome(rating))
      write(`graded ${id} ${rating}`)
      return yield* Effect.void
    }
    return yield* Effect.fail(new SessionError({ reason: usage }))
  })
