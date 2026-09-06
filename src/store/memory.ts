import { Effect, Layer, Ref } from "effect"
import { Store, type Record } from "./interface.ts"

export const Memory: Layer.Layer<Store> = Layer.effect(
  Store,
  Effect.gen(function* () {
    const log = yield* Ref.make<ReadonlyArray<Record>>([])
    return Store.of({
      append: (record) => Ref.update(log, (records) => [...records, record]),
      read: () =>
        Ref.get(log).pipe(Effect.map((records) => ({ records }))),
    })
  }),
)
