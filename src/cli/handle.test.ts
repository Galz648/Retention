import { DateTime, Effect, Layer, Schema } from "effect"
import { describe, expect, test } from "bun:test"
import { AlreadyArchived, CorpusNotFound, CorpusStore } from "../corpus/interface.ts"
import { RecallCard } from "../domain/cards.ts"
import { Corpus, Edge, Node, type TreeListing } from "../domain/corpus.ts"
import { CardId, NodeId, TreeId } from "../domain/ids.ts"
import { Inbox } from "../inbox/interface.ts"
import { InboxCaptured } from "../domain/events.ts"
import { Session } from "../session/interface.ts"
import { ClockAt } from "../testing/clock.ts"
import { handle, helpText, type CliIo } from "./handle.ts"

const asCardId = (s: string): CardId => Schema.decodeUnknownSync(CardId)(s)
const asNodeId = (s: string): NodeId => Schema.decodeUnknownSync(NodeId)(s)
const asTreeId = (s: string): TreeId => Schema.decodeUnknownSync(TreeId)(s)

const treeId = asTreeId("biology-ii")
const rootId = asNodeId("diffusion")
const cardId = asCardId("der-diffusion")

const card = new RecallCard({
  id: cardId,
  nodeId: rootId,
  prompt: "Explain Diffusion from scratch.",
  answer: "Net movement down a gradient.",
  tags: [],
})

const listing: TreeListing = {
  treeId,
  title: "Biology II",
  kind: "knowledge",
  summary: "Animal systems and ecology, from the course map.",
  archived: false,
  nodeCount: 1,
  cardCount: 1,
  edgeCount: 0,
}

const corpus = new Corpus({
  treeId,
  title: listing.title,
  kind: listing.kind,
  summary: listing.summary,
  archived: false,
  nodes: [new Node({ id: rootId, title: "Diffusion", cardIds: [cardId] })],
  edges: [] as ReadonlyArray<Edge>,
  cards: [card],
})

const CorpusFixed = Layer.succeed(
  CorpusStore,
  CorpusStore.of({
    read: (id) =>
      id === treeId
        ? Effect.succeed(corpus)
        : Effect.fail(new CorpusNotFound({ treeId: id })),
    list: () => Effect.succeed([listing]),
    archive: () => Effect.fail(new AlreadyArchived({ treeId })),
  }),
)

const mute = (rest: Partial<CliIo> = {}): CliIo => ({
  write: () => {},
  ask: () => Effect.succeed(undefined),
  select: () => Effect.succeed(undefined),
  interactive: false,
  logExists: false,
  color: false,
  banner: false,
  ...rest,
})

const run = (
  args: ReadonlyArray<string>,
  io: CliIo,
  graded: Array<string>,
  captured: Array<string> = [],
  pending: ReadonlyArray<string> = [],
): Promise<{
  lines: Array<string>
  graded: Array<string>
  captured: Array<string>
  error?: string
}> => {
  const Fake = Layer.succeed(
    Session,
    Session.of({
      queue: () => Effect.succeed([card]),
      grade: (_tree, id, rating) =>
        Effect.sync(() => {
          graded.push(`${id}:${rating}`)
        }),
    }),
  )
  const FakeInbox = Layer.succeed(
    Inbox,
    Inbox.of({
      capture: (text) =>
        Effect.sync(() => {
          captured.push(text)
        }),
      pending: () =>
        Effect.succeed(
          pending.map(
            (text) =>
              new InboxCaptured({
                text,
                at: DateTime.unsafeFromDate(
                  new Date("2026-03-10T12:00:00.000Z"),
                ),
              }),
          ),
        ),
    }),
  )
  const lines: Array<string> = []
  const write = (line: string) => {
    lines.push(line)
  }
  return Effect.runPromise(
    handle(args, { ...io, write }).pipe(
      Effect.provide(Fake),
      Effect.provide(FakeInbox),
      Effect.provide(CorpusFixed),
      Effect.provide(ClockAt(0)),
      Effect.match({
        onFailure: (error) => ({ lines, graded, captured, error: error.reason }),
        onSuccess: () => ({ lines, graded, captured }),
      }),
    ),
  )
}

describe("CLI handle", () => {
  test("no args and help print labeled commands with descriptions", async () => {
    const none = await run([], mute(), [])
    const help = await run(["help"], mute(), [])
    expect(none.lines.join("\n")).toContain(helpText)
    expect(help.lines.join("\n")).toBe(helpText)
    expect(help.lines.join("\n")).toContain("what you can do")
    expect(help.lines.join("\n")).toContain("[impure]")
    expect(help.lines.join("\n")).toContain("asks first")
    expect(help.lines.join("\n")).toContain("capture")
    expect(help.lines.join("\n")).toContain("inbox")
    expect(help.lines.join("\n")).not.toContain("\u001b")
  })

  test("banner appears only when asked, never on queue", async () => {
    const help = await run(["help"], mute({ banner: true }), [])
    expect(help.lines.join("\n")).toContain("██████")
    const queue = await run(["queue", "Biology II"], mute(), [])
    expect(queue.lines.join("\n")).not.toContain("██████")
  })

  test("trees groups kinds, prints summary, omits counts and folder names", async () => {
    const result = await run(["trees"], mute(), [])
    const text = result.lines.join("\n")
    expect(text).toContain("Knowledge trees")
    expect(text).toContain("Biology II")
    expect(text).toContain("Animal systems and ecology")
    expect(text).not.toContain("nodes")
    expect(text).not.toContain("biology-ii")
    expect(text).not.toContain("seed tree")
  })

  test("queue is numbered with node title and prompt, no card id", async () => {
    const result = await run(["queue", "Biology II"], mute(), [])
    expect(result.lines.join("\n")).toContain("queue — due cards for Biology II")
    expect(result.lines.join("\n")).toContain("1. [recall] Diffusion")
    expect(result.lines.join("\n")).toContain("Explain Diffusion from scratch.")
    expect(result.lines.join("\n")).not.toContain("der-diffusion")
  })

  test("show prints the answer", async () => {
    const result = await run(["show", "1", "Biology II"], mute(), [])
    expect(result.lines.join("\n")).toContain("Net movement down a gradient.")
  })

  test("grade without an interactive terminal refuses and does not write", async () => {
    const graded: Array<string> = []
    const result = await run(["grade", "1", "Good", "Biology II"], mute(), graded)
    expect(result.error).toBe("Need an interactive terminal to confirm a write.")
    expect(result.lines.join("\n")).toContain("This will create the event log.")
    expect(graded).toEqual([])
  })

  test("grade no does not write; grade yes does", async () => {
    const declined: Array<string> = []
    const no = await run(
      ["grade", "1", "Good", "Biology II"],
      mute({ interactive: true, logExists: true, ask: () => Effect.succeed("n") }),
      declined,
    )
    expect(no.lines.join("\n")).toContain("aborted")
    expect(declined).toEqual([])

    const accepted: Array<string> = []
    const yes = await run(
      ["grade", "1", "Good", "Biology II"],
      mute({
        interactive: true,
        logExists: true,
        ask: () => Effect.succeed("yes"),
      }),
      accepted,
    )
    expect(yes.lines.join("\n")).toContain("recorded")
    expect(yes.lines.join("\n")).not.toContain("This will create the event log.")
    expect(accepted).toEqual([`${cardId}:Good`])
  })

  test("capture without an interactive terminal refuses and does not write", async () => {
    const captured: Array<string> = []
    const result = await run(
      ["capture", "diffusion is high to low"],
      mute(),
      [],
      captured,
    )
    expect(result.error).toBe("Need an interactive terminal to confirm a write.")
    expect(result.lines.join("\n")).toContain("This will create the event log.")
    expect(captured).toEqual([])
  })

  test("capture no does not write; capture yes does", async () => {
    const declined: Array<string> = []
    const no = await run(
      ["capture", "diffusion is high to low"],
      mute({ interactive: true, logExists: true, ask: () => Effect.succeed("n") }),
      [],
      declined,
    )
    expect(no.lines.join("\n")).toContain("aborted")
    expect(declined).toEqual([])

    const accepted: Array<string> = []
    const yes = await run(
      ["capture", "diffusion is high to low"],
      mute({
        interactive: true,
        logExists: true,
        ask: () => Effect.succeed("yes"),
      }),
      [],
      accepted,
    )
    expect(yes.lines.join("\n")).toContain("captured")
    expect(yes.lines.join("\n")).not.toContain("This will create the event log.")
    expect(accepted).toEqual(["diffusion is high to low"])
  })

  test("inbox lists captured texts, not paths", async () => {
    const result = await run(["inbox"], mute(), [], [], ["diffusion is high to low"])
    const text = result.lines.join("\n")
    expect(text).toContain("inbox — captured notes waiting for curation")
    expect(text).toContain("1. diffusion is high to low")
    expect(text).not.toContain("data/log")
    expect(text).not.toContain("inbox.captured")
  })

  test("tree prints node titles and edges, not folder names", async () => {
    const result = await run(["tree", "Biology II"], mute(), [])
    expect(result.lines.join("\n")).toContain("Biology II")
    expect(result.lines.join("\n")).toContain("Diffusion")
    expect(result.lines.join("\n")).not.toContain("biology-ii")
  })

  test("completions zsh lists human titles", async () => {
    const result = await run(["completions", "zsh"], mute(), [])
    const text = result.lines.join("\n")
    expect(text.startsWith("#compdef retention")).toBe(true)
    expect(text).toContain("Biology II")
    expect(text).toContain("compdef")
    expect(text).not.toContain("biology-ii")
    expect(text).not.toContain("completions — shell completion script")
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
