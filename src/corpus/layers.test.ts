import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect, Schema } from "effect"
import { describe, expect, test } from "bun:test"
import { DerivationCard, RecallCard } from "../domain/cards.ts"
import { Corpus, Edge, Node } from "../domain/corpus.ts"
import { CardId, NodeId, TreeId } from "../domain/ids.ts"
import { CorpusStore } from "./interface.ts"
import { Live } from "./layers.ts"

const treeId = (s: string) => Schema.decodeUnknownSync(TreeId)(s)
const nodeId = (s: string) => Schema.decodeUnknownSync(NodeId)(s)
const cardId = (s: string) => Schema.decodeUnknownSync(CardId)(s)

const authoredRoot = join(import.meta.dir, "../../corpus")

const withStore = <A, E>(
  root: string,
  effect: Effect.Effect<A, E, CorpusStore>,
) => Effect.runPromise(effect.pipe(Effect.provide(Live(root))))

const failStore = <E>(
  root: string,
  effect: Effect.Effect<unknown, E, CorpusStore>,
) => withStore(root, Effect.flip(effect))

const writeTree = async (
  root: string,
  id: string,
  files: {
    readonly meta: { readonly title: string; readonly archived: boolean }
    readonly nodes: ReadonlyArray<unknown>
    readonly edges: ReadonlyArray<unknown>
    readonly cards: ReadonlyArray<unknown>
  },
): Promise<string> => {
  const dir = join(root, id)
  await Bun.write(join(dir, "meta.json"), `${JSON.stringify(files.meta, null, 2)}\n`)
  await Bun.write(
    join(dir, "nodes.jsonl"),
    `${files.nodes.map((row) => JSON.stringify(row)).join("\n")}\n`,
  )
  await Bun.write(
    join(dir, "edges.jsonl"),
    `${files.edges.map((row) => JSON.stringify(row)).join("\n")}\n`,
  )
  await Bun.write(
    join(dir, "cards.jsonl"),
    `${files.cards.map((row) => JSON.stringify(row)).join("\n")}\n`,
  )
  return dir
}

const tinyTree = {
  meta: { title: "Lexer then parser", archived: false as const },
  nodes: [
    { id: "lex", title: "Tokens", cardIds: ["rec-token"] },
    { id: "parse", title: "Concrete syntax tree", cardIds: ["der-shift-reduce"] },
  ],
  edges: [{ from: "lex", to: "parse" }],
  cards: [
    {
      _tag: "recall",
      id: "rec-token",
      nodeId: "lex",
      prompt: "What is a token?",
      answer: "A classified lexeme: a keyword, identifier, or literal.",
      tags: ["compiler"],
    },
    {
      _tag: "derivation",
      id: "der-shift-reduce",
      nodeId: "parse",
      prompt: "Show one shift-reduce step that consumes an identifier.",
      tags: ["compiler"],
      mustHits: ["shift", "reduce"],
    },
  ],
}

const expectedTiny = new Corpus({
  treeId: treeId("tiny"),
  archived: false,
  nodes: [
    new Node({
      id: nodeId("lex"),
      title: "Tokens",
      cardIds: [cardId("rec-token")],
    }),
    new Node({
      id: nodeId("parse"),
      title: "Concrete syntax tree",
      cardIds: [cardId("der-shift-reduce")],
    }),
  ],
  edges: [new Edge({ from: nodeId("lex"), to: nodeId("parse") })],
  cards: [
    new RecallCard({
      id: cardId("rec-token"),
      nodeId: nodeId("lex"),
      prompt: "What is a token?",
      answer: "A classified lexeme: a keyword, identifier, or literal.",
      tags: ["compiler"],
    }),
    new DerivationCard({
      id: cardId("der-shift-reduce"),
      nodeId: nodeId("parse"),
      prompt: "Show one shift-reduce step that consumes an identifier.",
      tags: ["compiler"],
      mustHits: ["shift", "reduce"],
    }),
  ],
})

describe("CorpusStore.Live", () => {
  test("read returns a Corpus matching the files", async () => {
    const root = await mkdtemp(join(tmpdir(), "nth-corpus-"))
    await writeTree(root, "tiny", tinyTree)
    const corpus = await withStore(
      root,
      Effect.gen(function* () {
        const store = yield* CorpusStore
        return yield* store.read(treeId("tiny"))
      }),
    )
    expect(corpus).toEqual(expectedTiny)
  })

  test("missing tree is CorpusNotFound", async () => {
    const root = await mkdtemp(join(tmpdir(), "nth-corpus-"))
    await expect(
      failStore(
        root,
        Effect.gen(function* () {
          const store = yield* CorpusStore
          return yield* store.read(treeId("nope"))
        }),
      ),
    ).resolves.toMatchObject({ _tag: "CorpusNotFound", treeId: "nope" })
  })

  test("unparseable files are CorpusCorrupt", async () => {
    const root = await mkdtemp(join(tmpdir(), "nth-corpus-"))
    await writeTree(root, "tiny", tinyTree)
    await Bun.write(join(root, "tiny", "nodes.jsonl"), "{not json\n")
    await expect(
      failStore(
        root,
        Effect.gen(function* () {
          const store = yield* CorpusStore
          return yield* store.read(treeId("tiny"))
        }),
      ),
    ).resolves.toMatchObject({ _tag: "CorpusCorrupt", treeId: "tiny" })
  })

  test("archive moves the tree; read still returns it with archived true", async () => {
    const root = await mkdtemp(join(tmpdir(), "nth-corpus-"))
    await writeTree(root, "tiny", tinyTree)
    const corpus = await withStore(
      root,
      Effect.gen(function* () {
        const store = yield* CorpusStore
        yield* store.archive(treeId("tiny"))
        return yield* store.read(treeId("tiny"))
      }),
    )
    expect(corpus.archived).toBe(true)
    expect(corpus.treeId).toBe(treeId("tiny"))
    expect(corpus.nodes).toEqual(expectedTiny.nodes)
    expect(await Bun.file(join(root, "tiny", "meta.json")).exists()).toBe(false)
    expect(
      await Bun.file(join(root, "archived", "tiny", "meta.json")).exists(),
    ).toBe(true)
  })

  test("archive of an already archived tree is AlreadyArchived", async () => {
    const root = await mkdtemp(join(tmpdir(), "nth-corpus-"))
    await writeTree(root, "tiny", tinyTree)
    await expect(
      failStore(
        root,
        Effect.gen(function* () {
          const store = yield* CorpusStore
          yield* store.archive(treeId("tiny"))
          return yield* store.archive(treeId("tiny"))
        }),
      ),
    ).resolves.toMatchObject({ _tag: "AlreadyArchived", treeId: "tiny" })
  })

  test("archive never deletes tree file contents", async () => {
    const root = await mkdtemp(join(tmpdir(), "nth-corpus-"))
    const live = await writeTree(root, "tiny", tinyTree)
    const nodesBefore = await Bun.file(join(live, "nodes.jsonl")).text()
    const edgesBefore = await Bun.file(join(live, "edges.jsonl")).text()
    const cardsBefore = await Bun.file(join(live, "cards.jsonl")).text()
    await withStore(
      root,
      Effect.gen(function* () {
        const store = yield* CorpusStore
        return yield* store.archive(treeId("tiny"))
      }),
    )
    const archived = join(root, "archived", "tiny")
    expect(await Bun.file(join(archived, "nodes.jsonl")).text()).toBe(nodesBefore)
    expect(await Bun.file(join(archived, "edges.jsonl")).text()).toBe(edgesBefore)
    expect(await Bun.file(join(archived, "cards.jsonl")).text()).toBe(cardsBefore)
    const meta = JSON.parse(await Bun.file(join(archived, "meta.json")).text()) as {
      archived: boolean
    }
    expect(meta.archived).toBe(true)
  })

  test("archive of a missing tree is CorpusNotFound", async () => {
    const root = await mkdtemp(join(tmpdir(), "nth-corpus-"))
    await expect(
      failStore(
        root,
        Effect.gen(function* () {
          const store = yield* CorpusStore
          return yield* store.archive(treeId("nope"))
        }),
      ),
    ).resolves.toMatchObject({ _tag: "CorpusNotFound", treeId: "nope" })
  })
})

describe("authored STLC tree", () => {
  test("round-trips through read", async () => {
    const corpus = await withStore(
      authoredRoot,
      Effect.gen(function* () {
        const store = yield* CorpusStore
        return yield* store.read(treeId("stlc"))
      }),
    )
    expect(corpus.treeId).toBe(treeId("stlc"))
    expect(corpus.archived).toBe(false)
    expect(corpus.nodes.map((node) => node.id)).toEqual([
      "terms",
      "types",
      "typing",
      "substitution",
      "safety",
    ])
    expect(corpus.edges).toHaveLength(5)
    expect(corpus.cards.some((card) => card._tag === "recall")).toBe(true)
    expect(corpus.cards.some((card) => card._tag === "derivation")).toBe(true)
    const terms = corpus.nodes.find((node) => node.id === "terms")
    expect(terms?.title).toBe("Terms: variables, abstraction, and application")
  })

  test("every edge endpoint exists as a node", async () => {
    const corpus = await withStore(
      authoredRoot,
      Effect.gen(function* () {
        const store = yield* CorpusStore
        return yield* store.read(treeId("stlc"))
      }),
    )
    const ids = new Set(corpus.nodes.map((node) => node.id))
    for (const edge of corpus.edges) {
      expect(ids.has(edge.from)).toBe(true)
      expect(ids.has(edge.to)).toBe(true)
    }
  })
})
