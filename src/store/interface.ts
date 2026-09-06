import { Context, Data, Effect, Schema } from "effect"

export const Record = Schema.String.pipe(Schema.brand("Record"))
export type Record = typeof Record.Type

export class PermissionDenied extends Data.TaggedError("PermissionDenied")<{
  readonly path: string
}> {}
export class NotFound extends Data.TaggedError("NotFound")<{
  readonly path: string
}> {}
export class NoSpace extends Data.TaggedError("NoSpace")<{
  readonly path: string
}> {}
export class IsDirectory extends Data.TaggedError("IsDirectory")<{
  readonly path: string
}> {}
export class InvalidUtf8 extends Data.TaggedError("InvalidUtf8")<{
  readonly path: string
}> {}
export class IoError extends Data.TaggedError("IoError")<{
  readonly path: string
  readonly cause: unknown
}> {}

export type StoreError =
  | PermissionDenied
  | NotFound
  | NoSpace
  | IsDirectory
  | InvalidUtf8
  | IoError

export class Store extends Context.Tag("nth/Store")<
  Store,
  {
    readonly append: (record: Record) => Effect.Effect<void, StoreError>
    readonly read: () => Effect.Effect<
      {
        readonly records: ReadonlyArray<Record>
        readonly unterminated?: string
      },
      StoreError
    >
  }
>() {}
