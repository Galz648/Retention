import { Context, Data, type Effect } from "effect"
import type { Corpus } from "../domain/corpus.ts"
import type { TreeId } from "../domain/ids.ts"

export class CorpusNotFound extends Data.TaggedError("CorpusNotFound")<{
  readonly treeId: TreeId
}> {}

export class CorpusCorrupt extends Data.TaggedError("CorpusCorrupt")<{
  readonly treeId: TreeId
  readonly cause: unknown
}> {}

export class AlreadyArchived extends Data.TaggedError("AlreadyArchived")<{
  readonly treeId: TreeId
}> {}

export type CorpusError = CorpusNotFound | CorpusCorrupt | AlreadyArchived

/**
 * I/O for the hand-authored tree. Session provides this. Engine does not
 * depend on it — graph receives a Corpus value.
 *
 * Archive must not delete files. Trees move to an archived location.
 */
export class CorpusStore extends Context.Tag("nth/CorpusStore")<
  CorpusStore,
  {
    readonly read: (
      treeId: TreeId,
    ) => Effect.Effect<Corpus, CorpusError>
    readonly archive: (treeId: TreeId) => Effect.Effect<void, CorpusError>
  }
>() {}
