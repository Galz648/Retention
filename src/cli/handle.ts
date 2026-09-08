import { type Clock, Effect, Schema } from "effect"
import { CorpusStore } from "../corpus/interface.ts"
import { Outcome, type Card } from "../domain/cards.ts"
import type { Corpus, TreeListing } from "../domain/corpus.ts"
import type { NodeId } from "../domain/ids.ts"
import { Session, SessionError } from "../session/interface.ts"
import { banner } from "./banner.ts"
import { completionsScript } from "./completions.ts"
import { palette, type Palette } from "./style.ts"
import { matchTitle, pickByNumber } from "./titles.ts"
import { formatTreesList } from "./trees-view.ts"

export type CliIo = {
  readonly write: (line: string) => void
  readonly ask: (question: string) => Effect.Effect<string | undefined>
  readonly select: (
    question: string,
    labels: ReadonlyArray<string>,
  ) => Effect.Effect<number | undefined>
  readonly interactive: boolean
  readonly logExists: boolean
  readonly color: boolean
  readonly banner: boolean
}

export const helpText = `[pure]    help            what you can do
[pure]    status          whether a log exists; which tree if you named one
[pure]    trees           every tree, by kind, with a one-line what-it-is
[pure]    tree            one tree: nodes and edges
[pure]    show            one due card including the answer / must-hits
[pure]    queue           due and unblocked cards, numbered
[impure]  grade           append one review — asks first
[pure]    completions     shell completion script (zsh or bash)`

const fail = (reason: string): Effect.Effect<never, SessionError> =>
  Effect.fail(new SessionError({ reason }))

const tagged = (error: { readonly _tag: string }): SessionError =>
  new SessionError({ reason: error._tag })

const nodeTitle = (corpus: Corpus, id: NodeId): string => {
  const node = corpus.nodes.find((item) => item.id === id)
  return node === undefined ? "unknown node" : node.title
}

const formatQueueLine = (
  index: number,
  card: Card,
  corpus: Corpus,
): string =>
  `${index}. [${card._tag}] ${nodeTitle(corpus, card.nodeId)}\n${card.prompt}`

const formatShow = (card: Card, corpus: Corpus): string => {
  const head = `[${card._tag}] ${nodeTitle(corpus, card.nodeId)}\n${card.prompt}`
  if (card._tag === "recall") {
    return `${head}\n${card.answer}`
  }
  return `${head}\nmust-hits: ${card.mustHits.join("; ")}`
}

const parseOutcome = (value: string) =>
  Schema.decodeUnknown(Outcome)(value).pipe(
    Effect.mapError(
      () => new SessionError({ reason: "Rating must be Again, Hard, Good, or Easy." }),
    ),
  )

const parseIndex = (
  raw: string,
  length: number,
): Effect.Effect<number, SessionError> => {
  if (!/^\d+$/.test(raw)) {
    return fail("Queue numbers start at 1.")
  }
  const index = Number(raw)
  if (index < 1 || index > length) {
    return fail("That number is not in the queue.")
  }
  return Effect.succeed(index)
}

const writeHelp = (io: CliIo, ink: Palette): void => {
  if (io.banner) {
    io.write(ink.heading(banner))
  }
  for (const line of helpText.split("\n")) {
    io.write(line.startsWith("[impure]") ? ink.warn(line) : line)
  }
}

const context = (io: CliIo, ink: Palette, line: string): void => {
  io.write(ink.dim(line))
}

const pickInteractive = (
  io: CliIo,
  listings: ReadonlyArray<TreeListing>,
): Effect.Effect<TreeListing, SessionError> =>
  Effect.gen(function* () {
    io.write(formatTreesList(listings))
    const answer = yield* io.ask("Which tree?")
    if (answer === undefined) {
      return yield* fail("Need an interactive terminal to pick a tree.")
    }
    const byNumber = pickByNumber(listings, answer)
    if (byNumber !== undefined) return byNumber
    const hits = matchTitle(listings, answer)
    if (hits.length === 1) {
      const hit = hits[0]
      if (hit !== undefined) return hit
    }
    if (hits.length === 0) {
      return yield* fail("No tree matches that title.")
    }
    return yield* fail("Several trees match.")
  })

const resolveTree = (
  io: CliIo,
  listings: ReadonlyArray<TreeListing>,
  query: string | undefined,
): Effect.Effect<TreeListing, SessionError> => {
  if (listings.length === 0) {
    return fail("No trees.")
  }
  if (query !== undefined && query.trim().length > 0) {
    const hits = matchTitle(listings, query)
    if (hits.length === 1) {
      const hit = hits[0]
      if (hit !== undefined) return Effect.succeed(hit)
    }
    if (hits.length === 0) {
      return fail("No tree matches that title.")
    }
    if (!io.interactive) {
      io.write(formatTreesList(hits))
      return fail("Several trees match. Name the title uniquely.")
    }
    return pickInteractive(io, hits)
  }
  if (!io.interactive) {
    io.write(formatTreesList(listings))
    return fail("Name a tree by title.")
  }
  return pickInteractive(io, listings)
}

const titleFromArgs = (
  args: ReadonlyArray<string>,
  from: number,
): string | undefined => {
  const rest = args.slice(from).join(" ").trim()
  return rest.length === 0 ? undefined : rest
}

const loadListings = (): Effect.Effect<
  ReadonlyArray<TreeListing>,
  SessionError,
  CorpusStore
> =>
  Effect.gen(function* () {
    const corpora = yield* CorpusStore
    return yield* corpora.list().pipe(Effect.mapError(tagged))
  })

const loadCorpus = (
  listing: TreeListing,
): Effect.Effect<Corpus, SessionError, CorpusStore> =>
  Effect.gen(function* () {
    const corpora = yield* CorpusStore
    return yield* corpora.read(listing.treeId).pipe(Effect.mapError(tagged))
  })

const formatTree = (corpus: Corpus): string => {
  const archived = corpus.archived ? "yes" : "no"
  const nodes = corpus.nodes
    .map((node) => {
      const n = node.cardIds.length
      return `  ${node.title} (${n} ${n === 1 ? "card" : "cards"})`
    })
    .join("\n")
  const titles = new Map(corpus.nodes.map((node) => [node.id, node.title]))
  const edges = corpus.edges.flatMap((edge) => {
    const from = titles.get(edge.from)
    const to = titles.get(edge.to)
    if (from === undefined || to === undefined) return []
    return [`  ${from} → ${to}`]
  })
  return `${corpus.title}\n${corpus.summary}\narchived: ${archived}\n\nNodes:\n${nodes}\n\nEdges:\n${edges.join("\n")}`
}

const yes = (raw: string): boolean => {
  const value = raw.trim().toLowerCase()
  return value === "y" || value === "yes"
}

export const handle = (
  args: ReadonlyArray<string>,
  io: CliIo,
): Effect.Effect<void, SessionError, Session | CorpusStore | Clock.Clock> =>
  Effect.gen(function* () {
    const ink = palette(io.color)
    const argv = args.slice()
    const command = argv[0] ?? "help"
    if (command === "help") {
      writeHelp(io, ink)
      return yield* Effect.void
    }
    if (command === "status") {
      context(io, ink, "status — whether a log exists; which tree if you named one")
      const query = titleFromArgs(argv, 1)
      io.write(io.logExists ? "event log: present" : "event log: none yet")
      if (query === undefined) {
        io.write("tree: (none)")
        return yield* Effect.void
      }
      const listing = yield* resolveTree(io, yield* loadListings(), query)
      io.write(`tree: ${listing.title}`)
      return yield* Effect.void
    }
    if (command === "trees") {
      context(io, ink, "trees — every tree, by kind, with a one-line what-it-is")
      const listings = yield* loadListings()
      if (listings.length === 0) {
        io.write("no trees")
        return yield* Effect.void
      }
      io.write(formatTreesList(listings))
      return yield* Effect.void
    }
    if (command === "tree") {
      const listing = yield* resolveTree(
        io,
        yield* loadListings(),
        titleFromArgs(argv, 1),
      )
      context(io, ink, `tree — nodes and edges for ${listing.title}`)
      const corpus = yield* loadCorpus(listing)
      io.write(formatTree(corpus))
      return yield* Effect.void
    }
    if (command === "queue") {
      const listing = yield* resolveTree(
        io,
        yield* loadListings(),
        titleFromArgs(argv, 1),
      )
      context(io, ink, `queue — due cards for ${listing.title}`)
      const session = yield* Session
      const corpus = yield* loadCorpus(listing)
      const cards = yield* session.queue(listing.treeId)
      if (cards.length === 0) {
        io.write("queue empty")
        return yield* Effect.void
      }
      cards.forEach((card, index) => {
        io.write(formatQueueLine(index + 1, card, corpus))
      })
      return yield* Effect.void
    }
    if (command === "show") {
      let rawIndex = argv[1]
      const listing = yield* resolveTree(
        io,
        yield* loadListings(),
        titleFromArgs(argv, rawIndex === undefined ? 1 : 2),
      )
      const session = yield* Session
      const corpus = yield* loadCorpus(listing)
      const cards = yield* session.queue(listing.treeId)
      if (rawIndex === undefined && io.interactive) {
        cards.forEach((card, index) => {
          io.write(`${index + 1}. [${card._tag}] ${nodeTitle(corpus, card.nodeId)}`)
        })
        const chosen = yield* io.ask("Which card number?")
        if (chosen !== undefined) rawIndex = chosen.trim()
      }
      if (rawIndex === undefined) {
        writeHelp(io, ink)
        return yield* fail(helpText)
      }
      context(io, ink, `show — one due card for ${listing.title}`)
      const index = yield* parseIndex(rawIndex, cards.length)
      const card = cards[index - 1]
      if (card === undefined) {
        return yield* fail("That number is not in the queue.")
      }
      io.write(formatShow(card, corpus))
      return yield* Effect.void
    }
    if (command === "grade") {
      let rawIndex = argv[1]
      let ratingRaw = argv[2]
      const listing = yield* resolveTree(
        io,
        yield* loadListings(),
        titleFromArgs(
          argv,
          rawIndex === undefined ? 1 : ratingRaw === undefined ? 2 : 3,
        ),
      )
      const session = yield* Session
      const corpus = yield* loadCorpus(listing)
      const cards = yield* session.queue(listing.treeId)
      if (rawIndex === undefined && io.interactive) {
        cards.forEach((card, index) => {
          io.write(`${index + 1}. [${card._tag}] ${nodeTitle(corpus, card.nodeId)}`)
        })
        const chosen = yield* io.ask("Which card number?")
        if (chosen !== undefined) rawIndex = chosen.trim()
      }
      if (ratingRaw === undefined && io.interactive) {
        io.write("Again  Hard  Good  Easy")
        const chosen = yield* io.ask("Rating?")
        if (chosen !== undefined) ratingRaw = chosen.trim()
      }
      if (rawIndex === undefined || ratingRaw === undefined) {
        writeHelp(io, ink)
        return yield* fail(helpText)
      }
      const rating = yield* parseOutcome(ratingRaw)
      const index = yield* parseIndex(rawIndex, cards.length)
      const card = cards[index - 1]
      if (card === undefined) {
        return yield* fail("That number is not in the queue.")
      }
      context(io, ink, `grade — append one review for ${listing.title}`)
      io.write(
        ink.warn(
          `Grade "${card.prompt}" (${nodeTitle(corpus, card.nodeId)}) as ${rating}.`,
        ),
      )
      io.write("This appends one review to the event log.")
      if (!io.logExists) {
        io.write(ink.warn("This will create the event log."))
      }
      if (!io.interactive) {
        return yield* fail("Need an interactive terminal to confirm a write.")
      }
      const answer = yield* io.ask("Proceed? [y/N]")
      if (answer === undefined || !yes(answer)) {
        io.write("aborted")
        return yield* Effect.void
      }
      yield* session.grade(listing.treeId, card.id, rating)
      io.write("recorded")
      return yield* Effect.void
    }
    if (command === "completions") {
      const shell = argv[1]
      if (shell === undefined) {
        return yield* fail("Say zsh or bash.")
      }
      const listings = yield* loadListings()
      const script = completionsScript(shell, listings)
      if (script === undefined) {
        return yield* fail("Say zsh or bash.")
      }
      io.write(script)
      return yield* Effect.void
    }
    writeHelp(io, ink)
    return yield* fail(helpText)
  })
