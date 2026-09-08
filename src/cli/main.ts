import { Clock, Effect, Layer, Schema } from "effect"
import { TreeId } from "../domain/ids.ts"
import { Runtime } from "../session/runtime.ts"
import { handle } from "./handle.ts"

type BunRuntime = {
  readonly argv: ReadonlyArray<string>
  readonly env: { readonly [key: string]: string | undefined }
}

type Io = {
  readonly log: (line: string) => void
  readonly error: (line: string) => void
}

const bun = (globalThis as unknown as { Bun: BunRuntime }).Bun
const io = (globalThis as unknown as { console: Io }).console

const treeId = Schema.decodeUnknownSync(TreeId)(bun.env["NTH_TREE"] ?? "stlc")
const logPath = bun.env["NTH_LOG"] ?? "data/log.jsonl"
const corpusDir = bun.env["NTH_CORPUS"] ?? "corpus"

const program = handle(bun.argv.slice(2), (line) => {
  io.log(line)
}).pipe(
  Effect.provide(
    Runtime({
      logPath,
      corpusDir,
      treeId,
    }),
  ),
  Effect.provide(Layer.succeed(Clock.Clock, Clock.make())),
)

const result = await Effect.runPromise(Effect.either(program))
if (result._tag === "Left") {
  io.error(result.left.reason)
  throw new Error(result.left.reason)
}
