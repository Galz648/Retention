import { Effect, Layer, Schema } from "effect"
import { describe, expect, test } from "bun:test"
import { RecallCard } from "../domain/cards.ts"
import { CardId, NodeId } from "../domain/ids.ts"
import { Session } from "../session/interface.ts"
import { ClockAt } from "../testing/clock.ts"
import { handle } from "./handle.ts"

const asCardId = (s: string): CardId => Schema.decodeUnknownSync(CardId)(s)
const asNodeId = (s: string): NodeId => Schema.decodeUnknownSync(NodeId)(s)

const card = new RecallCard({
  id: asCardId("c-root"),
  nodeId: asNodeId("root"),
  prompt: "root?",
  answer: "yes",
  tags: [],
})

describe("CLI handle", () => {
  test("queue prints session cards; grade forwards one rating", async () => {
    const graded: Array<string> = []
    const Fake = Layer.succeed(
      Session,
      Session.of({
        queue: () => Effect.succeed([card]),
        grade: (id, rating) =>
          Effect.sync(() => {
            graded.push(`${id}:${rating}`)
          }),
      }),
    )
    const lines: Array<string> = []
    await Effect.runPromise(
      handle(["queue"], (line) => lines.push(line)).pipe(
        Effect.provide(Fake),
        Effect.provide(ClockAt(0)),
      ),
    )
    expect(lines.join("\n")).toContain("[recall] c-root")
    expect(lines.join("\n")).toContain("root?")

    await Effect.runPromise(
      handle(["grade", "c-root", "Good"], (line) => lines.push(line)).pipe(
        Effect.provide(Fake),
        Effect.provide(ClockAt(0)),
      ),
    )
    expect(graded).toEqual(["c-root:Good"])
  })

  test("CLI sources do not import engine components", async () => {
    const glob = new Bun.Glob("src/cli/**/*.ts")
    for await (const path of glob.scan(".")) {
      if (path.endsWith(".test.ts")) continue
      const text = await Bun.file(path).text()
      expect(text).not.toMatch(/engine\/mastery/)
      expect(text).not.toMatch(/engine\/graph/)
      expect(text).not.toMatch(/engine\/scheduler/)
      expect(text).not.toMatch(/THRESHOLD/)
    }
  })
})
