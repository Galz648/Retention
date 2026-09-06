import { Effect, Layer } from "effect"
import { fold } from "./fold.ts"
import { Scheduler } from "./interface.ts"

export const Live = Layer.succeed(
  Scheduler,
  Scheduler.of({
    fold: (events, now) => Effect.sync(() => fold(events, now)),
  }),
)
