import { Layer } from "effect"
import { Live as CodecLive } from "../codec/layers.ts"
import { Live as CorpusLive } from "../corpus/layers.ts"
import type { TreeId } from "../domain/ids.ts"
import { Live as GraphLive } from "../engine/graph/live.ts"
import { Live as MasteryLive } from "../engine/mastery/live.ts"
import { Live as SchedulerLive } from "../engine/scheduler/live.ts"
import { Live as StoreLive } from "../store/jsonl.ts"
import { Live as SessionLive } from "./live.ts"
import type { Session } from "./interface.ts"

export const Runtime = (input: {
  readonly logPath: string
  readonly corpusDir: string
  readonly treeId: TreeId
}): Layer.Layer<Session> =>
  SessionLive(input.treeId).pipe(
    Layer.provide(MasteryLive),
    Layer.provide(GraphLive),
    Layer.provide(SchedulerLive),
    Layer.provide(StoreLive(input.logPath)),
    Layer.provide(CodecLive),
    Layer.provide(CorpusLive(input.corpusDir)),
  )
