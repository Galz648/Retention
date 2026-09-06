import { DateTime, Schema } from "effect"
import { describe, expect, test } from "bun:test"
import {
  CardCreated,
  CardId,
  CardMustHitAdded,
  CardRetired,
  CardReviewed,
  DerivationCard,
  InboxCaptured,
  InboxDiscarded,
  InboxId,
  InboxPromoted,
  RecallCard,
} from "../events/interface.ts"
import { fold } from "./fold.ts"

const utc = (iso: string): DateTime.Utc =>
  DateTime.unsafeFromDate(new Date(iso))

const cardId = (s: string) => Schema.decodeUnknownSync(CardId)(s)
const inboxId = (s: string) => Schema.decodeUnknownSync(InboxId)(s)

const day = "2026-03-10"
const at = utc(`${day}T12:00:00.000Z`)
const laterSameDay = utc(`${day}T18:00:00.000Z`)
const nextMonth = utc("2026-04-10T12:00:00.000Z")

const recall = (id: string, prompt = "peek or consume?") =>
  new RecallCard({
    id: cardId(id),
    prompt,
    answer: "peek does not consume",
    tags: ["compilers"],
  })

const derivation = (id: string) =>
  new DerivationCard({
    id: cardId(id),
    prompt: "Why does left recursion loop?",
    tags: ["compilers"],
    mustHits: ["re-enters the same production with no input consumed"],
  })

const created = (card: ReturnType<typeof recall> | ReturnType<typeof derivation>, when = at) =>
  new CardCreated({
    id: card.id,
    at: when,
    origin: "curation",
    card,
  })

describe("fold — empty and history", () => {
  test("accepts an empty log: nothing due, empty inbox, history is that log", () => {
    const state = fold([], at)
    expect(state.due.recall).toEqual([])
    expect(state.due.derivation).toEqual([])
    expect(state.inbox).toEqual([])
    expect(state.history).toEqual([])
  })

  test("accepts history as the event list itself, in order", () => {
    const events = [
      new InboxCaptured({
        id: inboxId("in-1"),
        at,
        text: "tokeniser peek?",
      }),
      created(recall("card-1")),
    ]
    expect(fold(events, at).history).toBe(events)
  })
})

describe("fold — inbox", () => {
  test("accepts a capture into the open inbox", () => {
    const id = inboxId("in-1")
    const state = fold(
      [new InboxCaptured({ id, at, text: "tokeniser peek?" })],
      at,
    )
    expect(state.inbox).toEqual([{ id, at, text: "tokeniser peek?" }])
    expect(state.due.recall).toEqual([])
  })

  test("accepts discard: capture leaves the inbox", () => {
    const id = inboxId("in-1")
    const state = fold(
      [
        new InboxCaptured({ id, at, text: "once" }),
        new InboxDiscarded({ id, at: laterSameDay, reason: "seen only once" }),
      ],
      laterSameDay,
    )
    expect(state.inbox).toEqual([])
  })

  test("accepts promote: capture leaves the inbox even without a card.created", () => {
    const id = inboxId("in-1")
    const state = fold(
      [
        new InboxCaptured({ id, at, text: "left recursion" }),
        new InboxPromoted({
          id,
          at: laterSameDay,
          cardId: cardId("card-1"),
        }),
      ],
      laterSameDay,
    )
    expect(state.inbox).toEqual([])
  })

  test("rejects discard of an unknown inbox id: empty stays empty", () => {
    const state = fold(
      [
        new InboxDiscarded({
          id: inboxId("ghost"),
          at,
          reason: "never captured",
        }),
      ],
      at,
    )
    expect(state.inbox).toEqual([])
  })
})

describe("fold — due queue", () => {
  test("accepts a new card as due on the day it was created", () => {
    const card = recall("card-1")
    const state = fold([created(card)], at)
    expect(state.due.recall.map((c) => c.id)).toEqual([card.id])
    expect(state.due.derivation).toEqual([])
  })

  test("accepts recall-then-derivation as two lists, never mixed", () => {
    const r = recall("card-r")
    const d = derivation("card-d")
    const state = fold([created(r), created(d)], at)
    expect(state.due.recall.map((c) => c.id)).toEqual([r.id])
    expect(state.due.derivation.map((c) => c.id)).toEqual([d.id])
  })

  test("accepts overdue: unreviewed card still due a month later", () => {
    const card = recall("card-1")
    const state = fold([created(card)], nextMonth)
    expect(state.due.recall.map((c) => c.id)).toEqual([card.id])
  })

  test("accepts Good: first review takes the card off today's queue", () => {
    const card = recall("card-1")
    const state = fold(
      [
        created(card),
        new CardReviewed({ id: card.id, at, rating: "Good" }),
      ],
      laterSameDay,
    )
    expect(state.due.recall).toEqual([])
    expect(state.due.derivation).toEqual([])
  })

  test("accepts Again the same way: short-term off, so next due is tomorrow, not later today", () => {
    const card = recall("card-1")
    const state = fold(
      [
        created(card),
        new CardReviewed({ id: card.id, at, rating: "Again" }),
      ],
      laterSameDay,
    )
    expect(state.due.recall).toEqual([])
  })
})

describe("fold — rejects (ignores) illegal or unmatched events", () => {
  test("rejects review of an unknown card: no row appears", () => {
    const state = fold(
      [
        new CardReviewed({
          id: cardId("ghost"),
          at,
          rating: "Good",
        }),
      ],
      at,
    )
    expect(state.due.recall).toEqual([])
    expect(state.due.derivation).toEqual([])
  })

  test("rejects review of a retired card: stays off the queue", () => {
    const card = recall("card-1")
    const state = fold(
      [
        created(card),
        new CardRetired({ id: card.id, at: laterSameDay, reason: "prompt wrong" }),
        new CardReviewed({ id: card.id, at: laterSameDay, rating: "Again" }),
      ],
      laterSameDay,
    )
    expect(state.due.recall).toEqual([])
  })

  test("rejects must-hit on a recall card: shape stays recall, no mustHits", () => {
    const card = recall("card-1")
    const state = fold(
      [
        created(card),
        new CardMustHitAdded({
          id: card.id,
          at: laterSameDay,
          mustHit: "should not stick",
          exposedBy: "review",
        }),
      ],
      laterSameDay,
    )
    const due = state.due.recall[0]
    expect(due?._tag).toBe("recall")
    expect(due).not.toHaveProperty("mustHits")
  })

  test("rejects must-hit and review when the card was never created", () => {
    const id = cardId("ghost")
    const state = fold(
      [
        new CardMustHitAdded({
          id,
          at,
          mustHit: "nope",
          exposedBy: "review",
        }),
        new CardRetired({ id, at, reason: "never existed" }),
      ],
      at,
    )
    expect(state.due.recall).toEqual([])
    expect(state.due.derivation).toEqual([])
  })

  test("rejects retired cards from the due queue even if they would be overdue", () => {
    const card = recall("card-1")
    const state = fold(
      [
        created(card),
        new CardRetired({ id: card.id, at: laterSameDay, reason: "replaced" }),
      ],
      nextMonth,
    )
    expect(state.due.recall).toEqual([])
  })
})

describe("fold — derivation must-hits", () => {
  test("accepts must-hit accretion on a derivation card", () => {
    const card = derivation("card-d")
    const extra = "a rewrite breaks the cycle"
    const state = fold(
      [
        created(card),
        new CardMustHitAdded({
          id: card.id,
          at: laterSameDay,
          mustHit: extra,
          exposedBy: "review",
        }),
      ],
      laterSameDay,
    )
    const due = state.due.derivation[0]
    expect(due?._tag).toBe("derivation")
    if (due?._tag === "derivation") {
      expect(due.mustHits).toEqual([
        "re-enters the same production with no input consumed",
        extra,
      ])
    }
  })
})
