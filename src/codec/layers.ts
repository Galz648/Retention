import { Effect, Layer } from "effect"
import { NotImplemented } from "../events/not-implemented.ts"
import { Codec } from "./interface.ts"

export const Live = Layer.succeed(
  Codec,
  Codec.of({
    encode: (_event) => Effect.fail(new NotImplemented({ module: "Codec" })),
    decode: (_record) => Effect.fail(new NotImplemented({ module: "Codec" })),
  }),
)
