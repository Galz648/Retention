import { type DateTime } from "effect"
import {
  createEmptyCard,
  fsrs,
  Rating,
  type Card as FsrsCard,
} from "ts-fsrs"
import type { Card, CardId, Event, InboxId, Outcome } from "../events/interface.ts"
import { DerivationCard } from "../events/interface.ts"
import type { DueQueue, OpenCapture, State } from "./interface.ts"

const engine = fsrs({
  enable_fuzz: false,
  enable_short_term: false,
})

const rating: Record<Outcome, Rating.Again | Rating.Hard | Rating.Good | Rating.Easy> =
  {
    Again: Rating.Again,
    Hard: Rating.Hard,
    Good: Rating.Good,
    Easy: Rating.Easy,
  }

const toDate = (utc: DateTime.Utc): Date => new Date(utc.epochMillis)

const localDayKey = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const isDue = (due: Date, now: DateTime.Utc): boolean =>
  localDayKey(due.getTime()) <= localDayKey(now.epochMillis)

type Row = {
  card: Card
  fsrs: FsrsCard
  retired: boolean
}

export const fold = (
  events: ReadonlyArray<Event>,
  now: DateTime.Utc,
): State => {
  const cards = new Map<CardId, Row>()
  const inbox = new Map<InboxId, OpenCapture>()

  for (const event of events) {
    switch (event._tag) {
      case "inbox.captured": {
        inbox.set(event.id, {
          id: event.id,
          at: event.at,
          text: event.text,
        })
        break
      }
      case "inbox.discarded": {
        inbox.delete(event.id)
        break
      }
      case "inbox.promoted": {
        inbox.delete(event.id)
        break
      }
      case "card.created": {
        cards.set(event.id, {
          card: event.card,
          fsrs: createEmptyCard(toDate(event.at)),
          retired: false,
        })
        break
      }
      case "card.reviewed": {
        const row = cards.get(event.id)
        if (row === undefined || row.retired) break
        row.fsrs = engine.next(row.fsrs, toDate(event.at), rating[event.rating])
          .card
        break
      }
      case "card.mustHitAdded": {
        const row = cards.get(event.id)
        if (row === undefined || row.retired) break
        if (row.card._tag !== "derivation") break
        row.card = new DerivationCard({
          id: row.card.id,
          prompt: row.card.prompt,
          tags: row.card.tags,
          mustHits: [...row.card.mustHits, event.mustHit],
        })
        break
      }
      case "card.retired": {
        const row = cards.get(event.id)
        if (row === undefined) break
        row.retired = true
        break
      }
    }
  }

  const dueCards = [...cards.values()]
    .filter((row) => !row.retired && isDue(row.fsrs.due, now))
    .sort((a, b) => {
      const byDue = a.fsrs.due.getTime() - b.fsrs.due.getTime()
      if (byDue !== 0) return byDue
      return a.card.id < b.card.id ? -1 : a.card.id > b.card.id ? 1 : 0
    })

  const due: DueQueue = {
    recall: dueCards
      .filter((row) => row.card._tag === "recall")
      .map((row) => row.card),
    derivation: dueCards
      .filter((row) => row.card._tag === "derivation")
      .map((row) => row.card),
  }

  return {
    due,
    inbox: [...inbox.values()],
    history: events,
  }
}
