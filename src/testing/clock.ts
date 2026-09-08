import { Clock, Effect, Layer } from "effect"

/**
 * Session and tests provide Clock. Engine Live layers must never include this
 * (or Clock.make, or any other Clock provider).
 */
export const clockAt = (epochMillis: number): Clock.Clock => {
  const nanos = BigInt(epochMillis) * 1_000_000n
  return {
    [Clock.ClockTypeId]: Clock.ClockTypeId,
    unsafeCurrentTimeMillis: () => epochMillis,
    unsafeCurrentTimeNanos: () => nanos,
    currentTimeMillis: Effect.sync(() => epochMillis),
    currentTimeNanos: Effect.sync(() => nanos),
    sleep: () => Effect.void,
  }
}

export const ClockAt = (epochMillis: number): Layer.Layer<Clock.Clock> =>
  Layer.succeed(Clock.Clock, clockAt(epochMillis))
