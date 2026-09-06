import { Effect, Layer } from "effect"
import { NotImplemented } from "../events/not-implemented.ts"
import { Core } from "./interface.ts"

export const Live = Layer.succeed(
  Core,
  Core.of({
    due: (_now) => Effect.fail(new NotImplemented({ module: "Core" })),
    record: (_cardId, _outcome, _now) =>
      Effect.fail(new NotImplemented({ module: "Core" })),
    add: (_card) => Effect.fail(new NotImplemented({ module: "Core" })),
    capture: (_text, _now) =>
      Effect.fail(new NotImplemented({ module: "Core" })),
    inbox: () => Effect.fail(new NotImplemented({ module: "Core" })),
    history: () => Effect.fail(new NotImplemented({ module: "Core" })),
  }),
)
