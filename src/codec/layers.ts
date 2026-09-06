import { Effect, Layer, Schema } from "effect"
import { Event } from "../events/interface.ts"
import { Record } from "../store/interface.ts"
import {
  Codec,
  IncompleteRecord,
  InvalidEvent,
  SyntaxError,
} from "./interface.ts"

const asRecord = (json: string): Record => Schema.decodeUnknownSync(Record)(json)

const isIncompleteJson = (text: string, cause: unknown): boolean => {
  if (text.length === 0) return false
  return (
    cause instanceof globalThis.SyntaxError &&
    /unexpected end|unexpected eof/i.test(cause.message)
  )
}

export const Live = Layer.succeed(
  Codec,
  Codec.of({
    encode: (event) =>
      Effect.sync(() => {
        const encoded = Schema.encodeUnknownSync(Event)(event)
        return asRecord(JSON.stringify(encoded))
      }),
    decode: (record) =>
      Effect.try({
        try: (): unknown => JSON.parse(record),
        catch: (cause) =>
          isIncompleteJson(record, cause)
            ? new IncompleteRecord({ unterminated: record })
            : new SyntaxError({ record, cause }),
      }).pipe(
        Effect.flatMap((json) =>
          Schema.decodeUnknown(Event)(json).pipe(
            Effect.mapError((cause) => new InvalidEvent({ record, cause })),
          ),
        ),
      ),
  }),
)
