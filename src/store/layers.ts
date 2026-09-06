import { Effect, Layer } from "effect"
import type { StoreError } from "./interface.ts"
import { Store } from "./interface.ts"
import { NotImplemented } from "./not-implemented.ts"

const stub = (module: string): Effect.Effect<never, StoreError> =>
  Effect.fail(new NotImplemented({ module })) as unknown as Effect.Effect<
    never,
    StoreError
  >

export const Live = Layer.succeed(
  Store,
  Store.of({
    append: (_record) => stub("Store.Live"),
    read: () => stub("Store.Live"),
  }),
)

export const Memory = Layer.succeed(
  Store,
  Store.of({
    append: (_record) => stub("Store.Memory"),
    read: () => stub("Store.Memory"),
  }),
)
