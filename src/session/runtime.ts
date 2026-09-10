import { Layer } from "effect"
import { Live as CodecLive } from "../codec/layers.ts"
import { CorpusStore } from "../corpus/interface.ts"
import { Live as CorpusLive } from "../corpus/layers.ts"
import { Live as GraphLive } from "../engine/graph/live.ts"
import { Live as MasteryLive } from "../engine/mastery/live.ts"
import { Live as SchedulerLive } from "../engine/scheduler/live.ts"
import { Inbox } from "../inbox/interface.ts"
import { Live as InboxLive } from "../inbox/live.ts"
import { Live as StoreLive } from "../store/jsonl.ts"
import { Live as SessionLive } from "./live.ts"
import type { Session } from "./interface.ts"

export const Runtime = (input: {
  readonly logPath: string
  readonly corpusDir: string
}): Layer.Layer<Session | CorpusStore | Inbox> => {
  const corpus = CorpusLive(input.corpusDir)
  const store = StoreLive(input.logPath)
  const codec = CodecLive
  return Layer.mergeAll(
    corpus,
    InboxLive.pipe(Layer.provide(store), Layer.provide(codec)),
    SessionLive().pipe(
      Layer.provide(MasteryLive),
      Layer.provide(GraphLive),
      Layer.provide(SchedulerLive),
      Layer.provide(store),
      Layer.provide(codec),
      Layer.provide(corpus),
    ),
  )
}
