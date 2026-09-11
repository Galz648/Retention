import { Effect, Layer, Schema } from "effect"
import { Card } from "../domain/cards.ts"
import { Corpus, Edge, Node, Track, type TreeListing } from "../domain/corpus.ts"
import { TreeId } from "../domain/ids.ts"
import {
  AlreadyArchived,
  CorpusCorrupt,
  CorpusNotFound,
  CorpusStore,
  type CorpusError,
} from "./interface.ts"

const Meta = Schema.Struct({
  title: Schema.String,
  archived: Schema.Boolean,
  kind: Schema.Literal("knowledge", "terms"),
  summary: Schema.String,
  belongsTo: Schema.optional(TreeId),
  track: Schema.optional(Track),
})

type BunRuntime = {
  readonly file: (path: string) => {
    readonly exists: () => Promise<boolean>
    readonly text: () => Promise<string>
  }
  readonly write: (path: string, data: string) => Promise<number>
  readonly spawn: (
    command: ReadonlyArray<string>,
    options: { readonly stdout: "ignore"; readonly stderr: "ignore" },
  ) => { readonly exited: Promise<number> }
  readonly Glob: new (pattern: string) => {
    scan: (input: {
      readonly cwd: string
      readonly onlyFiles?: boolean
    }) => AsyncIterable<string>
  }
}

const bun: BunRuntime = (
  globalThis as typeof globalThis & { Bun: BunRuntime }
).Bun

const liveDir = (root: string, treeId: TreeId): string => `${root}/${treeId}`

const archivedDir = (root: string, treeId: TreeId): string =>
  `${root}/archived/${treeId}`

const metaPath = (dir: string): string => `${dir}/meta.json`

const io = <A>(
  treeId: TreeId,
  try_: () => Promise<A>,
): Effect.Effect<A, CorpusCorrupt> =>
  Effect.tryPromise({
    try: try_,
    catch: (cause) => new CorpusCorrupt({ treeId, cause }),
  })

const exists = (
  path: string,
  treeId: TreeId,
): Effect.Effect<boolean, CorpusCorrupt> =>
  io(treeId, () => bun.file(path).exists())

const readText = (
  path: string,
  treeId: TreeId,
): Effect.Effect<string, CorpusCorrupt> =>
  io(treeId, async () => {
    const file = bun.file(path)
    if (!(await file.exists())) {
      throw new Error(`missing file: ${path}`)
    }
    return await file.text()
  })

const writeText = (
  path: string,
  text: string,
  treeId: TreeId,
): Effect.Effect<void, CorpusCorrupt> =>
  io(treeId, async () => {
    await bun.write(path, text)
  })

const run = (
  argv: ReadonlyArray<string>,
  treeId: TreeId,
): Effect.Effect<void, CorpusCorrupt> =>
  io(treeId, async () => {
    const proc = bun.spawn(argv, { stdout: "ignore", stderr: "ignore" })
    const code = await proc.exited
    if (code !== 0) {
      throw new Error(`${argv.join(" ")} exited ${code}`)
    }
  })

const decodeJson = (
  text: string,
  treeId: TreeId,
): Effect.Effect<unknown, CorpusCorrupt> =>
  Effect.try({
    try: (): unknown => JSON.parse(text),
    catch: (cause) => new CorpusCorrupt({ treeId, cause }),
  })

const readMeta = (
  path: string,
  treeId: TreeId,
): Effect.Effect<typeof Meta.Type, CorpusCorrupt> =>
  Effect.gen(function* () {
    const text = yield* readText(path, treeId)
    const json = yield* decodeJson(text, treeId)
    return yield* Schema.decodeUnknown(Meta)(json).pipe(
      Effect.mapError((cause) => new CorpusCorrupt({ treeId, cause })),
    )
  })

const readJsonl = <A, I>(
  schema: Schema.Schema<A, I>,
  path: string,
  treeId: TreeId,
): Effect.Effect<ReadonlyArray<A>, CorpusCorrupt> =>
  Effect.gen(function* () {
    const text = yield* readText(path, treeId)
    const out: Array<A> = []
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line === undefined || line.trim().length === 0) continue
      const json = yield* decodeJson(line, treeId)
      const value = yield* Schema.decodeUnknown(schema)(json).pipe(
        Effect.mapError((cause) => new CorpusCorrupt({ treeId, cause })),
      )
      out.push(value)
    }
    return out
  })

const locate = (
  root: string,
  treeId: TreeId,
): Effect.Effect<"live" | "archived" | "missing", CorpusCorrupt> =>
  Effect.gen(function* () {
    if (yield* exists(metaPath(liveDir(root, treeId)), treeId)) {
      return "live"
    }
    if (yield* exists(metaPath(archivedDir(root, treeId)), treeId)) {
      return "archived"
    }
    return "missing"
  })

const readFrom = (
  dir: string,
  treeId: TreeId,
  archived: boolean,
): Effect.Effect<Corpus, CorpusCorrupt> =>
  Effect.gen(function* () {
    const meta = yield* readMeta(metaPath(dir), treeId)
    const nodes = yield* readJsonl(Node, `${dir}/nodes.jsonl`, treeId)
    const edges = yield* readJsonl(Edge, `${dir}/edges.jsonl`, treeId)
    const cards = yield* readJsonl(Card, `${dir}/cards.jsonl`, treeId)
    return new Corpus({
      treeId,
      title: meta.title,
      kind: meta.kind,
      summary: meta.summary,
      archived: archived || meta.archived,
      track: meta.track ?? "university",
      belongsTo: meta.belongsTo,
      nodes,
      edges,
      cards,
    })
  })

const readTree = (
  root: string,
  treeId: TreeId,
): Effect.Effect<Corpus, CorpusError> =>
  Effect.gen(function* () {
    const where = yield* locate(root, treeId)
    if (where === "missing") {
      return yield* Effect.fail(new CorpusNotFound({ treeId }))
    }
    return yield* readFrom(
      where === "live" ? liveDir(root, treeId) : archivedDir(root, treeId),
      treeId,
      where === "archived",
    )
  })

const listingOf = (corpus: Corpus): TreeListing => ({
  treeId: corpus.treeId,
  title: corpus.title,
  kind: corpus.kind,
  summary: corpus.summary,
  archived: corpus.archived,
  track: corpus.track,
  belongsTo: corpus.belongsTo,
  nodeCount: corpus.nodes.length,
  cardCount: corpus.cards.length,
  edgeCount: corpus.edges.length,
})

const listingId = Schema.decodeUnknownSync(TreeId)("corpus")

const globRelative = (
  root: string,
  pattern: string,
): Effect.Effect<ReadonlyArray<string>, CorpusCorrupt> =>
  io(listingId, async () => {
    const glob = new bun.Glob(pattern)
    const out: Array<string> = []
    for await (const relative of glob.scan({ cwd: root, onlyFiles: true })) {
      out.push(relative)
    }
    return out
  })

const treeIdFromMetaPath = (
  relative: string,
): Effect.Effect<TreeId, CorpusCorrupt> => {
  const parts = relative.split("/")
  const folder =
    parts[0] === "archived" && parts.length >= 2 ? parts[1] : parts[0]
  if (folder === undefined || folder.length === 0) {
    return Effect.fail(
      new CorpusCorrupt({ treeId: listingId, cause: relative }),
    )
  }
  return Effect.succeed(Schema.decodeUnknownSync(TreeId)(folder))
}

const listTrees = (
  root: string,
): Effect.Effect<ReadonlyArray<TreeListing>, CorpusError> =>
  Effect.gen(function* () {
    const live = yield* globRelative(root, "*/meta.json")
    const archived = yield* globRelative(root, "archived/*/meta.json")
    const seen = new Set<string>()
    const listings: Array<TreeListing> = []
    for (const relative of [...live, ...archived]) {
      const id = yield* treeIdFromMetaPath(relative)
      if (seen.has(id)) continue
      seen.add(id)
      const corpus = yield* readTree(root, id)
      listings.push(listingOf(corpus))
    }
    listings.sort((left, right) => {
      if (left.title < right.title) return -1
      if (left.title > right.title) return 1
      return 0
    })
    return listings
  })

const archiveTree = (
  root: string,
  treeId: TreeId,
): Effect.Effect<void, CorpusError> =>
  Effect.gen(function* () {
    const where = yield* locate(root, treeId)
    if (where === "archived") {
      return yield* Effect.fail(new AlreadyArchived({ treeId }))
    }
    if (where === "missing") {
      return yield* Effect.fail(new CorpusNotFound({ treeId }))
    }
    const from = liveDir(root, treeId)
    const to = archivedDir(root, treeId)
    const meta = yield* readMeta(metaPath(from), treeId)
    yield* writeText(
      metaPath(from),
      `${JSON.stringify(
        {
          title: meta.title,
          kind: meta.kind,
          summary: meta.summary,
          archived: true,
          ...(meta.belongsTo === undefined ? {} : { belongsTo: meta.belongsTo }),
          ...(meta.track === undefined ? {} : { track: meta.track }),
        },
        null,
        2,
      )}\n`,
      treeId,
    )
    yield* run(["mkdir", "-p", `${root}/archived`], treeId)
    yield* run(["mv", from, to], treeId)
  })

/** `corpusDir` holds `<treeId>/` trees and `archived/`. */
export const Live = (corpusDir: string): Layer.Layer<CorpusStore> =>
  Layer.succeed(
    CorpusStore,
    CorpusStore.of({
      read: (id) => readTree(corpusDir, id),
      list: () => listTrees(corpusDir),
      archive: (id) => archiveTree(corpusDir, id),
    }),
  )
