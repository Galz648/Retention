import { Effect, Layer } from "effect"
import { THRESHOLD } from "../../config.ts"
import { Scheduler } from "./interface.ts"

export const Live: Layer.Layer<Scheduler> = Layer.succeed(
  Scheduler,
  Scheduler.of({
    due: (values) =>
      Effect.sync(() =>
        [...values]
          .filter(([, brightness]) => brightness < THRESHOLD)
          .map(([id]) => id)
          .sort(),
      ),
  }),
)
