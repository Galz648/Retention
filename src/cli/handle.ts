import { Effect, Schema } from "effect"
import { CorpusStore } from "../corpus/interface.ts"
import { Outcome } from "../domain/cards.ts"
import type { Corpus, Track, TreeListing } from "../domain/corpus.ts"
import { GapSeverity } from "../domain/events.ts"
import type { CardId } from "../domain/ids.ts"
import { Gap, GapError } from "../gap/interface.ts"
import { Inbox, InboxError } from "../inbox/interface.ts"
import { Session, SessionError } from "../session/interface.ts"
import { banner } from "./banner.ts"
import { formatQueueLine, formatShow, nodeTitle } from "./cards-view.ts"
import { completionsScript } from "./completions.ts"
import { eligibleLines, fullSnapshot, zeroSnapshot } from "./graph.ts"
import { evaluateTree } from "./mastery.ts"
import { dueLines, fullValues, zeroValues } from "./scheduler.ts"
import { runSession, type SessionEntry } from "./session.ts"
import { palette, type Palette } from "./style.ts"
import { matchTitle, matchTrack, pickByNumber } from "./titles.ts"
import { formatTreesList, onTrack, presentTracks, TRACK_HEADING } from "./trees-view.ts"
import type { Key } from "./tui.ts"
import { VERSION } from "./version.ts"

export type CliIo = {
  readonly write: (line: string) => void
  readonly ask: (question: string) => Effect.Effect<string | undefined>
  readonly readKey: () => Effect.Effect<Key | undefined>
  readonly select: (
    question: string,
    labels: ReadonlyArray<string>,
  ) => Effect.Effect<number | undefined>
  readonly interactive: boolean
  readonly logExists: boolean
  readonly color: boolean
  readonly banner: boolean
  readonly raw?: { readonly setRawMode?: (value: boolean) => void } | undefined
}

export const helpText = `[pure]    help            what you can do
[pure]    version         which build this is
[pure]    status          whether a log exists; which tree if you named one
[pure]    trees           every tree, by track then kind, with a one-line what-it-is
[pure]    session         options menu, then Session or the map; q quit
[pure]    mastery         brightness per card in one tree
[pure]    graph           eligible nodes if nothing is known, or full
[pure]    scheduler       due cards from a brightness probe
[pure]    show            one due card including the answer / must-hits
[pure]    queue           due and unblocked cards, numbered
[pure]    inbox           captured notes waiting for curation
[pure]    gaps            observed misses, titles not ids
[impure]  grade           append one review — asks first
[impure]  capture         append one inbox note — asks first
[impure]  gap             append one gap observation — asks first
[pure]    completions     shell completion script (zsh or bash)`

const fail = (reason: string): Effect.Effect<never, SessionError> =>
  Effect.fail(new SessionError({ reason }))

const tagged = (error: { readonly _tag: string }): SessionError =>
  new SessionError({ reason: error._tag })

const parseOutcome = (value: string) =>
  Schema.decodeUnknown(Outcome)(value).pipe(
    Effect.mapError(
      () => new SessionError({ reason: "Rating must be Again, Hard, Good, or Easy." }),
    ),
  )

const parseSeverity = (value: string) =>
  Schema.decodeUnknown(GapSeverity)(value).pipe(
    Effect.mapError(
      () =>
        new SessionError({
          reason: "Severity must be core-error, gap, or minor.",
        }),
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
  io.write(`retention ${VERSION}`)
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

const pickTrack = (
  io: CliIo,
  listings: ReadonlyArray<TreeListing>,
): Effect.Effect<Track, SessionError> =>
  Effect.gen(function* () {
    const tracks = presentTracks(listings)
    if (tracks.length === 0) {
      return yield* fail("No trees.")
    }
    if (tracks.length === 1) {
      const only = tracks[0]
      if (only !== undefined) return only
    }
    for (const track of tracks) {
      io.write(TRACK_HEADING[track])
    }
    const answer = yield* io.ask("Which track?")
    if (answer === undefined) {
      return yield* fail("Need an interactive terminal to pick a tree.")
    }
    const hit = matchTrack(answer)
    if (hit !== undefined && tracks.includes(hit)) return hit
    return yield* fail("No track matches.")
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
  return Effect.gen(function* () {
    const track = yield* pickTrack(io, listings)
    const scoped = onTrack(listings, track)
    if (scoped.length === 0) {
      return yield* fail("No trees on that track.")
    }
    return yield* pickInteractive(io, scoped)
  })
}

const titleFromArgs = (
  args: ReadonlyArray<string>,
  from: number,
): string | undefined => {
  const rest = args
    .slice(from)
    .filter((item) => item.toLowerCase() !== "full")
    .join(" ")
    .trim()
  return rest.length === 0 ? undefined : rest
}

const wantsFull = (args: ReadonlyArray<string>): boolean =>
  args.some((item) => item.toLowerCase() === "full")

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

const describeCard = (
  listings: ReadonlyArray<TreeListing>,
  id: CardId,
): Effect.Effect<
  { readonly title: string; readonly node: string; readonly prompt: string },
  SessionError,
  CorpusStore
> =>
  Effect.gen(function* () {
    for (const listing of listings) {
      const corpus = yield* loadCorpus(listing)
      const found = corpus.cards.find((item) => item.id === id)
      if (found === undefined) continue
      return {
        title: listing.title,
        node: nodeTitle(corpus, found.nodeId),
        prompt: found.prompt,
      }
    }
    return {
      title: "unknown tree",
      node: "unknown node",
      prompt: "a card that is no longer in a tree",
    }
  })

const yes = (raw: string): boolean => {
  const value = raw.trim().toLowerCase()
  return value === "y" || value === "yes"
}

export const handle = (args: ReadonlyArray<string>, io: CliIo) =>
  Effect.gen(function* () {
    const ink = palette(io.color)
    const argv = args.slice()
    const command = argv[0] ?? (io.interactive ? "session" : "help")
    if (command === "help") {
      writeHelp(io, ink)
      return yield* Effect.void
    }
    if (command === "version" || command === "--version" || command === "-V") {
      io.write(`retention ${VERSION}`)
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
      const listings = yield* loadListings()
      if (listings.length === 0) {
        context(io, ink, "trees — every tree, by track then kind, with a one-line what-it-is")
        io.write("no trees")
        return yield* Effect.void
      }
      if (!io.interactive) {
        context(io, ink, "trees — every tree, by track then kind, with a one-line what-it-is")
        io.write(formatTreesList(listings, ink))
        return yield* Effect.void
      }
      const session = yield* Session
      yield* runSession(
        io,
        ink,
        listings,
        loadCorpus,
        {
          version: VERSION,
          logExists: io.logExists,
          queue: (treeId) => session.queue(treeId),
          grade: (treeId, cardId, rating) => session.grade(treeId, cardId, rating),
        },
        { _tag: "trees" },
      )
      return yield* Effect.void
    }
    if (command === "session") {
      const listings = yield* loadListings()
      if (listings.length === 0) {
        context(io, ink, "session — options menu, then Session or the map; q quit")
        io.write("no trees")
        return yield* Effect.void
      }
      if (!io.interactive) {
        context(io, ink, "session — options menu, then Session or the map; q quit")
        io.write(formatTreesList(listings, ink))
        return yield* Effect.void
      }
      const query = titleFromArgs(argv, 1)
      const start =
        query === undefined
          ? undefined
          : yield* resolveTree(io, listings, query)
      const session = yield* Session
      const entry: SessionEntry =
        start === undefined
          ? { _tag: "home" }
          : { _tag: "session", listing: start }
      yield* runSession(
        io,
        ink,
        listings,
        loadCorpus,
        {
          version: VERSION,
          logExists: io.logExists,
          queue: (treeId) => session.queue(treeId),
          grade: (treeId, cardId, rating) => session.grade(treeId, cardId, rating),
        },
        entry,
      )
      return yield* Effect.void
    }
    if (command === "mastery") {
      const listing = yield* resolveTree(
        io,
        yield* loadListings(),
        titleFromArgs(argv, 1),
      )
      context(io, ink, `mastery — brightness per card in ${listing.title}`)
      io.write(yield* evaluateTree(listing.treeId))
      return yield* Effect.void
    }
    if (command === "graph") {
      const listing = yield* resolveTree(
        io,
        yield* loadListings(),
        titleFromArgs(argv, 1),
      )
      const corpus = yield* loadCorpus(listing)
      const full = wantsFull(argv)
      context(
        io,
        ink,
        full
          ? `graph — eligible nodes for ${listing.title} if everything is known`
          : `graph — eligible nodes for ${listing.title} if nothing is known`,
      )
      io.write(
        yield* eligibleLines(corpus, full ? fullSnapshot(corpus) : zeroSnapshot(corpus)),
      )
      return yield* Effect.void
    }
    if (command === "scheduler") {
      const listing = yield* resolveTree(
        io,
        yield* loadListings(),
        titleFromArgs(argv, 1),
      )
      const corpus = yield* loadCorpus(listing)
      const full = wantsFull(argv)
      context(
        io,
        ink,
        full
          ? `scheduler — due cards for ${listing.title} if everything is known`
          : `scheduler — due cards for ${listing.title} if nothing is known`,
      )
      io.write(
        yield* dueLines(corpus, full ? fullValues(corpus.cards) : zeroValues(corpus.cards)),
      )
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
        io.write(ink.empty("queue empty"))
        return yield* Effect.void
      }
      cards.forEach((card, index) => {
        io.write(ink.due(formatQueueLine(index + 1, card, corpus)))
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
        return yield* fail("Need a queue number.")
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
        return yield* fail("Need a queue number and a rating.")
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
    if (command === "inbox") {
      context(io, ink, "inbox — captured notes waiting for curation")
      const inbox = yield* Inbox
      const pending = yield* inbox.pending().pipe(
        Effect.mapError(
          (error: InboxError) => new SessionError({ reason: error.reason }),
        ),
      )
      if (pending.length === 0) {
        io.write("inbox empty")
        return yield* Effect.void
      }
      pending.forEach((entry, index) => {
        io.write(`${index + 1}. ${entry.text}`)
      })
      return yield* Effect.void
    }
    if (command === "capture") {
      let text = titleFromArgs(argv, 1)
      if ((text === undefined || text.trim().length === 0) && io.interactive) {
        const chosen = yield* io.ask("Capture what?")
        if (chosen !== undefined) text = chosen
      }
      const trimmed = text?.trim() ?? ""
      if (trimmed.length === 0) {
        writeHelp(io, ink)
        return yield* fail("Need something to capture.")
      }
      context(io, ink, "capture — append one inbox note")
      const shown =
        trimmed.length <= 80 ? trimmed : `${trimmed.slice(0, 77)}...`
      io.write(ink.warn(`Capture "${shown}".`))
      io.write("This appends one inbox note to the event log.")
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
      const inbox = yield* Inbox
      yield* inbox.capture(trimmed).pipe(
        Effect.mapError((error: InboxError) =>
          error.reason === "empty"
            ? new SessionError({ reason: "Need something to capture." })
            : new SessionError({ reason: error.reason }),
        ),
      )
      io.write("captured")
      return yield* Effect.void
    }
    if (command === "gaps") {
      context(io, ink, "gaps — observed misses, titles not ids")
      const gap = yield* Gap
      const pending = yield* gap.pending().pipe(
        Effect.mapError(
          (error: GapError) => new SessionError({ reason: error.reason }),
        ),
      )
      if (pending.length === 0) {
        io.write("gaps empty")
        return yield* Effect.void
      }
      const listings = yield* loadListings()
      for (const [index, entry] of pending.entries()) {
        const place = yield* describeCard(listings, entry.id)
        io.write(
          `${index + 1}. ${place.title} — ${place.node} [${entry.severity}] ${entry.subConcept}`,
        )
        io.write(entry.observation)
      }
      return yield* Effect.void
    }
    if (command === "gap") {
      let rawIndex = argv[1]
      let severityRaw = argv[2]
      let subConcept = argv[3]
      let observation = argv[4]
      const listing = yield* resolveTree(
        io,
        yield* loadListings(),
        titleFromArgs(argv, 5),
      )
      const session = yield* Session
      const corpus = yield* loadCorpus(listing)
      const cards = yield* session.queue(listing.treeId)
      if (rawIndex === undefined && io.interactive) {
        cards.forEach((item, index) => {
          io.write(`${index + 1}. [${item._tag}] ${nodeTitle(corpus, item.nodeId)}`)
        })
        const chosen = yield* io.ask("Which card number?")
        if (chosen !== undefined) rawIndex = chosen.trim()
      }
      if (severityRaw === undefined && io.interactive) {
        io.write("core-error  gap  minor")
        const chosen = yield* io.ask("Severity?")
        if (chosen !== undefined) severityRaw = chosen.trim()
      }
      if ((subConcept === undefined || subConcept.trim().length === 0) && io.interactive) {
        const chosen = yield* io.ask("Which sub-concept was missed?")
        if (chosen !== undefined) subConcept = chosen
      }
      if (
        (observation === undefined || observation.trim().length === 0) &&
        io.interactive
      ) {
        const chosen = yield* io.ask("What did they miss?")
        if (chosen !== undefined) observation = chosen
      }
      const concept = subConcept?.trim() ?? ""
      const seen = observation?.trim() ?? ""
      if (rawIndex === undefined || severityRaw === undefined) {
        writeHelp(io, ink)
        return yield* fail("Need a queue number, severity, sub-concept, and observation.")
      }
      if (concept.length === 0 || seen.length === 0) {
        writeHelp(io, ink)
        return yield* fail("Need a sub-concept and an observation.")
      }
      const severity = yield* parseSeverity(severityRaw)
      const index = yield* parseIndex(rawIndex, cards.length)
      const found = cards[index - 1]
      if (found === undefined) {
        return yield* fail("That number is not in the queue.")
      }
      context(io, ink, `gap — append one gap observation for ${listing.title}`)
      io.write(
        ink.warn(
          `Miss on "${found.prompt}" (${nodeTitle(corpus, found.nodeId)}): ${concept} [${severity}].`,
        ),
      )
      io.write("This appends one gap observation to the event log.")
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
      const gap = yield* Gap
      yield* gap
        .observe({
          id: found.id,
          subConcept: concept,
          observation: seen,
          severity,
        })
        .pipe(
          Effect.mapError((error: GapError) =>
            error.reason === "empty"
              ? new SessionError({ reason: "Need a sub-concept and an observation." })
              : new SessionError({ reason: error.reason }),
          ),
        )
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
    return yield* fail("Unknown command.")
  })
