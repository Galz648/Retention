import { Data } from "effect"

export class NotImplemented extends Data.TaggedError("NotImplemented")<{
  readonly module: string
}> {}
