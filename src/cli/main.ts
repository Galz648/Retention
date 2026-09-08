import { Clock, Effect, Layer } from "effect"
import { Runtime } from "../session/runtime.ts"
import { handle, type CliIo } from "./handle.ts"
import { colorEnabled } from "./style.ts"

type BunRuntime = {
  readonly argv: ReadonlyArray<string>
  readonly file: (path: string) => { readonly exists: () => Promise<boolean> }
  readonly env: { readonly [key: string]: string | undefined }
}

type Io = {
  readonly log: (line: string) => void
  readonly error: (line: string) => void
}

type ProcessLike = {
  readonly exit: (code: number) => never
  readonly stdin?: {
    readonly isTTY?: boolean
    readonly unref?: () => void
  }
  readonly stdout?: { readonly isTTY?: boolean }
}

const bun = (globalThis as unknown as { Bun: BunRuntime }).Bun
const io = (globalThis as unknown as { console: Io }).console
const processLike = globalThis as unknown as { process?: ProcessLike }
const proc = processLike.process

const corpusDir = "corpus"
const logPath = "data/log.jsonl"

const stdoutTty = proc?.stdout?.isTTY === true
const stdinTty = proc?.stdin?.isTTY === true
const noColor = (bun.env["NO_COLOR"] ?? "") !== ""
const color = colorEnabled({ stdoutTty, noColor })
const interactive = stdinTty

proc?.stdin?.unref?.()

const ask: CliIo["ask"] = (question) =>
  Effect.sync(() => {
    if (!interactive) return undefined
    const promptFn = (
      globalThis as unknown as { prompt?: (q: string) => string | null }
    ).prompt
    if (promptFn === undefined) return undefined
    const raw = promptFn(question)
    return raw === null ? "" : raw
  })

const logExists = await bun.file(logPath).exists()

const program = handle(bun.argv.slice(2), {
  write: (line) => {
    io.log(line)
  },
  ask,
  select: () => Effect.succeed(undefined),
  interactive,
  logExists,
  color,
  banner: color,
}).pipe(
  Effect.provide(
    Runtime({
      logPath,
      corpusDir,
    }),
  ),
  Effect.provide(Layer.succeed(Clock.Clock, Clock.make())),
)

const result = await Effect.runPromise(Effect.either(program))
if (result._tag === "Left") {
  io.error(result.left.reason)
  proc?.exit(1)
}
proc?.exit(0)
