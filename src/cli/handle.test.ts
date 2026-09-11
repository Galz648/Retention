import { DateTime, Effect, Layer, Schema } from "effect"
import { describe, expect, test } from "bun:test"
import { Live as CodecLive } from "../codec/layers.ts"
import { AlreadyArchived, CorpusNotFound, CorpusStore } from "../corpus/interface.ts"
import { RecallCard } from "../domain/cards.ts"
import { Corpus, Edge, Node, type TreeListing } from "../domain/corpus.ts"
import { CardId, NodeId, TreeId } from "../domain/ids.ts"
import { Inbox } from "../inbox/interface.ts"
import { Gap } from "../gap/interface.ts"
import { GapObserved, InboxCaptured } from "../domain/events.ts"
import { Live as GraphLive } from "../engine/graph/live.ts"
import { Live as MasteryLive } from "../engine/mastery/live.ts"
import { Live as SchedulerLive } from "../engine/scheduler/live.ts"
import { Session } from "../session/interface.ts"
import { Memory } from "../store/memory.ts"
import { ClockAt } from "../testing/clock.ts"
import { handle, helpText, type CliIo } from "./handle.ts"
import type { Key } from "./tui.ts"
import { VERSION } from "./version.ts"

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
  track: "university",
  summary: "Animal systems and ecology, from the course map.",
  archived: false,
  belongsTo: undefined,
  nodeCount: 1,
  cardCount: 1,
  edgeCount: 0,
}

const corpus = new Corpus({
  treeId,
  title: listing.title,
  kind: listing.kind,
  track: listing.track,
  summary: listing.summary,
  archived: false,
  belongsTo: undefined,
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
  readKey: () => Effect.succeed(undefined),
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
  observed: Array<string> = [],
  pendingGaps: ReadonlyArray<GapObserved> = [],
): Promise<{
  lines: Array<string>
  graded: Array<string>
  captured: Array<string>
  observed: Array<string>
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
  const FakeGap = Layer.succeed(
    Gap,
    Gap.of({
      observe: (input) =>
        Effect.sync(() => {
          observed.push(
            `${input.id}:${input.severity}:${input.subConcept}:${input.observation}`,
          )
        }),
      pending: () => Effect.succeed(pendingGaps),
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
      Effect.provide(FakeGap),
      Effect.provide(CorpusFixed),
      Effect.provide(ClockAt(0)),
      Effect.provide(GraphLive),
      Effect.provide(SchedulerLive),
      Effect.provide(MasteryLive),
      Effect.provide(Memory),
      Effect.provide(CodecLive),
      Effect.match({
        onFailure: (error) => ({
          lines,
          graded,
          captured,
          observed,
          error: error.reason,
        }),
        onSuccess: () => ({ lines, graded, captured, observed }),
      }),
    ),
  )
}

describe("CLI handle", () => {
  test("no args and help print labeled commands with descriptions", async () => {
    const none = await run([], mute(), [])
    const help = await run(["help"], mute(), [])
    expect(none.lines.join("\n")).toContain(helpText)
    expect(help.lines.join("\n")).toBe(`retention ${VERSION}\n${helpText}`)
    expect(help.lines.join("\n")).toContain("what you can do")
    expect(help.lines.join("\n")).toContain("[impure]")
    expect(help.lines.join("\n")).toContain("asks first")
    expect(help.lines.join("\n")).toContain("capture")
    expect(help.lines.join("\n")).toContain("inbox")
    expect(help.lines.join("\n")).toContain("gap")
    expect(help.lines.join("\n")).toContain("gaps")
    expect(help.lines.join("\n")).toContain("session")
    expect(help.lines.join("\n")).toContain("which build this is")
    expect(help.lines.join("\n")).toContain("mastery")
    expect(help.lines.join("\n")).toContain("graph")
    expect(help.lines.join("\n")).toContain("scheduler")
    expect(help.lines.join("\n")).not.toContain("one tree: nodes")
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
    expect(text).toContain("University — course work")
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

  test("gap without an interactive terminal refuses and does not write", async () => {
    const observed: Array<string> = []
    const result = await run(
      [
        "gap",
        "1",
        "core-error",
        "concentration gradient direction",
        "stated low->high",
        "Biology II",
      ],
      mute(),
      [],
      [],
      [],
      observed,
    )
    expect(result.error).toBe("Need an interactive terminal to confirm a write.")
    expect(result.lines.join("\n")).toContain("This will create the event log.")
    expect(observed).toEqual([])
  })

  test("gap no does not write; gap yes does", async () => {
    const declined: Array<string> = []
    const no = await run(
      [
        "gap",
        "1",
        "core-error",
        "concentration gradient direction",
        "stated low->high",
        "Biology II",
      ],
      mute({ interactive: true, logExists: true, ask: () => Effect.succeed("n") }),
      [],
      [],
      [],
      declined,
    )
    expect(no.lines.join("\n")).toContain("aborted")
    expect(declined).toEqual([])

    const accepted: Array<string> = []
    const yes = await run(
      [
        "gap",
        "1",
        "core-error",
        "concentration gradient direction",
        "stated low->high",
        "Biology II",
      ],
      mute({
        interactive: true,
        logExists: true,
        ask: () => Effect.succeed("yes"),
      }),
      [],
      [],
      [],
      accepted,
    )
    expect(yes.lines.join("\n")).toContain("recorded")
    expect(yes.lines.join("\n")).toContain("Diffusion")
    expect(yes.lines.join("\n")).not.toContain("der-diffusion")
    expect(yes.lines.join("\n")).not.toContain("This will create the event log.")
    expect(accepted).toEqual([
      `${cardId}:core-error:concentration gradient direction:stated low->high`,
    ])
  })

  test("gaps lists titles and misses, not ids", async () => {
    const pendingGaps = [
      new GapObserved({
        id: cardId,
        at: DateTime.unsafeFromDate(new Date("2026-03-10T12:00:00.000Z")),
        subConcept: "concentration gradient direction",
        observation: "stated low->high; it is high->low",
        severity: "core-error",
      }),
    ]
    const result = await run(["gaps"], mute(), [], [], [], [], pendingGaps)
    const text = result.lines.join("\n")
    expect(text).toContain("gaps — observed misses, titles not ids")
    expect(text).toContain("Biology II")
    expect(text).toContain("Diffusion")
    expect(text).toContain("concentration gradient direction")
    expect(text).toContain("stated low->high; it is high->low")
    expect(text).toContain("core-error")
    expect(text).not.toContain("der-diffusion")
    expect(text).not.toContain("gap.observed")
    expect(text).not.toContain("biology-ii")
  })

  test("version prints the build", async () => {
    const result = await run(["version"], mute(), [])
    expect(result.lines.join("\n")).toBe(`retention ${VERSION}`)
    const flag = await run(["--version"], mute(), [])
    expect(flag.lines.join("\n")).toBe(`retention ${VERSION}`)
  })

  test("removed tree command is unknown", async () => {
    const result = await run(["tree", "Biology II"], mute(), [])
    expect(result.error).toBe("Unknown command.")
  })

  test("session without a TTY prints the nested list and returns", async () => {
    const result = await run(["session"], mute(), [])
    expect(result.error).toBeUndefined()
    expect(result.lines.join("\n")).toContain("Biology II")
    expect(result.lines.join("\n")).toContain("University — course work")
    expect(result.lines.join("\n")).toContain("Knowledge trees")
  })

  test("TTY session from the CLI: options then due queue", async () => {
    const keys: Array<Key> = [
      { _tag: "enter" },
      { _tag: "enter" },
      { _tag: "quit" },
    ]
    let index = 0
    const result = await run(
      ["session"],
      mute({
        interactive: true,
        readKey: () => {
          const next = keys[index]
          index += 1
          return Effect.succeed(next)
        },
      }),
      [],
    )
    expect(result.error).toBeUndefined()
    expect(result.lines.join("\n")).toContain("options")
    expect(result.lines.join("\n")).toContain("Session")
    expect(result.lines.join("\n")).toContain("session — Biology II")
    expect(result.lines.join("\n")).toContain("Explain Diffusion from scratch.")
  })

  test("TTY trees from the CLI: you-are-here in the map", async () => {
    const keys: Array<Key> = [
      { _tag: "enter" },
      { _tag: "enter" },
      { _tag: "quit" },
    ]
    let index = 0
    const result = await run(
      ["trees"],
      mute({
        interactive: true,
        readKey: () => {
          const next = keys[index]
          index += 1
          return Effect.succeed(next)
        },
      }),
      [],
    )
    expect(result.error).toBeUndefined()
    expect(result.lines.join("\n")).toContain("trees — walk the map")
    expect(result.lines.join("\n")).toContain("trees — Biology II")
    expect(result.lines.join("\n")).toContain("●")
    expect(result.lines.join("\n")).toContain("Diffusion")
  })

  test("TTY session from the CLI: inspect then abort grade", async () => {
    const graded: Array<string> = []
    const keys: Array<Key> = [
      { _tag: "enter" },
      { _tag: "enter" },
      { _tag: "enter" },
      { _tag: "enter" },
      { _tag: "enter" },
      { _tag: "quit" },
    ]
    let index = 0
    const result = await run(
      ["session"],
      mute({
        interactive: true,
        readKey: () => {
          const next = keys[index]
          index += 1
          return Effect.succeed(next)
        },
      }),
      graded,
    )
    expect(result.error).toBeUndefined()
    expect(result.lines.join("\n")).toContain("Net movement down a gradient.")
    expect(result.lines.join("\n")).toContain("This appends one review")
    expect(graded).toEqual([])
  })

  test("interactive session q returns", async () => {
    const result = await run(
      ["session"],
      mute({
        interactive: true,
        readKey: () => Effect.succeed({ _tag: "quit" }),
      }),
      [],
    )
    expect(result.error).toBeUndefined()
    expect(result.lines.join("\n")).toContain(`retention ${VERSION}`)
    expect(result.lines.join("\n")).toContain("options")
    expect(result.lines.join("\n")).toContain("Session")
    expect(result.lines.join("\n")).toContain("Trees")
    expect(result.lines.join("\n")).toContain("Status")
  })

  test("interactive no args enters session", async () => {
    const result = await run(
      [],
      mute({
        interactive: true,
        readKey: () => Effect.succeed({ _tag: "quit" }),
      }),
      [],
    )
    expect(result.error).toBeUndefined()
    expect(result.lines.join("\n")).toContain("options")
    expect(result.lines.join("\n")).toContain("Session")
  })

  test("interactive session with a title opens that tree", async () => {
    const result = await run(
      ["session", "Biology II"],
      mute({
        interactive: true,
        readKey: () => Effect.succeed({ _tag: "quit" }),
      }),
      [],
    )
    expect(result.error).toBeUndefined()
    expect(result.lines.join("\n")).toContain("session — Biology II")
  })

  test("unknown command prints help once and fails with a short reason", async () => {
    const result = await run(["nope"], mute(), [])
    expect(result.error).toBe("Unknown command.")
    expect(result.lines.join("\n")).toBe(`retention ${VERSION}\n${helpText}`)
  })

  test("mastery prints brightness with node title, not card id", async () => {
    const result = await run(["mastery", "Biology II"], mute(), [])
    expect(result.error).toBeUndefined()
    expect(result.lines.join("\n")).toContain("Diffusion")
    expect(result.lines.join("\n")).toContain("Explain Diffusion from scratch.")
    expect(result.lines.join("\n")).not.toContain("der-diffusion")
  })

  test("graph zero probe lists roots eligible", async () => {
    const result = await run(["graph", "Biology II"], mute(), [])
    expect(result.error).toBeUndefined()
    expect(result.lines.join("\n")).toContain("Eligible")
    expect(result.lines.join("\n")).toContain("Diffusion")
  })

  test("scheduler zero probe lists due cards; full is none due", async () => {
    const noneKnown = await run(["scheduler", "Biology II"], mute(), [])
    expect(noneKnown.lines.join("\n")).toContain("Diffusion")
    expect(noneKnown.lines.join("\n")).toContain("Explain Diffusion from scratch.")
    expect(noneKnown.lines.join("\n")).not.toContain("der-diffusion")
    const allKnown = await run(["scheduler", "full", "Biology II"], mute(), [])
    expect(allKnown.lines.join("\n")).toContain("none due")
  })

  test("completions zsh lists human titles", async () => {
    const result = await run(["completions", "zsh"], mute(), [])
    const text = result.lines.join("\n")
    expect(text.startsWith("#compdef retention")).toBe(true)
    expect(text).toContain("Biology II")
    expect(text).toContain("compdef")
    expect(text).toContain("gap:")
    expect(text).toContain("gaps:")
    expect(text).not.toContain("biology-ii")
    expect(text).not.toContain("completions — shell completion script")
  })

  test("session CLI modules do not import engine components", async () => {
    const wiring = new Set(["src/cli/handle.ts"])
    const isolated = new Set([
      "src/cli/mastery.ts",
      "src/cli/graph.ts",
      "src/cli/scheduler.ts",
    ])
    const glob = new Bun.Glob("src/cli/**/*.ts")
    for await (const path of glob.scan(".")) {
      if (path.endsWith(".test.ts") || wiring.has(path)) continue
      const text = await Bun.file(path).text()
      if (isolated.has(path)) {
        const others = ["mastery", "graph", "scheduler"].filter(
          (name) => !path.endsWith(`${name}.ts`),
        )
        for (const other of others) {
          expect(text).not.toMatch(new RegExp(`engine/${other}`))
        }
        continue
      }
      expect(text).not.toMatch(/engine\/mastery/)
      expect(text).not.toMatch(/engine\/graph/)
      expect(text).not.toMatch(/engine\/scheduler/)
      expect(text).not.toMatch(/THRESHOLD/)
    }
  })
})
