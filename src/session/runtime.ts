import { Layer } from "effect"
import { Codec } from "../codec/interface.ts"
import { Live as CodecLive } from "../codec/layers.ts"
import { CorpusStore } from "../corpus/interface.ts"
import { Live as CorpusLive } from "../corpus/layers.ts"
import { Graph } from "../engine/graph/interface.ts"
import { Live as GraphLive } from "../engine/graph/live.ts"
import { Mastery } from "../engine/mastery/interface.ts"
import { Live as MasteryLive } from "../engine/mastery/live.ts"
import { Scheduler } from "../engine/scheduler/interface.ts"
import { Live as SchedulerLive } from "../engine/scheduler/live.ts"
import { Inbox } from "../inbox/interface.ts"
import { Live as InboxLive } from "../inbox/live.ts"
import { Store } from "../store/interface.ts"
import { Live as StoreLive } from "../store/jsonl.ts"
import { Session } from "./interface.ts"
import { Live as SessionLive } from "./live.ts"

export const Runtime = (input: {
  readonly logPath: string
  readonly corpusDir: string
}): Layer.Layer<
  Session | CorpusStore | Inbox | Store | Codec | Mastery | Graph | Scheduler
> => {
  const corpus = CorpusLive(input.corpusDir)
  const store = StoreLive(input.logPath)
  const codec = CodecLive
  const mastery = MasteryLive
  const graph = GraphLive
  const scheduler = SchedulerLive
  return Layer.mergeAll(
    corpus,
    store,
    codec,
    mastery,
    graph,
    scheduler,
    InboxLive.pipe(Layer.provide(store), Layer.provide(codec)),
    SessionLive().pipe(
      Layer.provide(mastery),
      Layer.provide(graph),
      Layer.provide(scheduler),
      Layer.provide(store),
      Layer.provide(codec),
      Layer.provide(corpus),
    ),
  )
}
