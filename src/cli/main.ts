import { readSync } from "node:fs"
import { Clock, Effect, Layer } from "effect"
import { Runtime } from "../session/runtime.ts"
import { handle, type CliIo } from "./handle.ts"
import { colorEnabled } from "./style.ts"
import { detectTty } from "./tty.ts"
import { installTerminalRestore, readKeySync } from "./tui.ts"

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
  readonly on?: (event: "SIGINT" | "SIGTERM", fn: () => void) => void
  readonly stdin?: {
    readonly isTTY?: boolean
    readonly setRawMode?: (value: boolean) => void
  }
  readonly stdout?: {
    readonly isTTY?: boolean
    readonly write?: (text: string) => void
  }
}

const bun = (globalThis as unknown as { Bun: BunRuntime }).Bun
const io = (globalThis as unknown as { console: Io }).console
const processLike = globalThis as unknown as { process?: ProcessLike }
const proc = processLike.process

const corpusDir = "corpus"
const logPath = "data/log.jsonl"

const tty = detectTty({
  stdinTty: proc?.stdin?.isTTY,
  stdoutTty: proc?.stdout?.isTTY,
  stdinFd: 0,
  stdoutFd: 1,
})
const noColor = (bun.env["NO_COLOR"] ?? "") !== ""
const interactive = tty.stdin && tty.stdout
const color = colorEnabled({ tty: tty.stdout, noColor })

const write = (line: string): void => {
  const text = line.endsWith("\n") ? line : `${line}\n`
  if (proc?.stdout?.write !== undefined) {
    proc.stdout.write(text)
    return
  }
  io.log(line)
}

installTerminalRestore(
  (text) => {
    try {
      proc?.stdout?.write?.(text)
    } catch {
      // process is already going away
    }
  },
  proc?.stdin ?? {},
  (event, fn) => {
    proc?.on?.(event, () => {
      fn()
      proc?.exit(1)
    })
  },
)

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

const readKey: CliIo["readKey"] = interactive
  ? readKeySync(readSync)
  : () => Effect.succeed(undefined)

const logExists = await bun.file(logPath).exists()

const program = handle(bun.argv.slice(2), {
  write,
  ask,
  readKey,
  select: () => Effect.succeed(undefined),
  interactive,
  logExists,
  color,
  banner: color,
  raw: proc?.stdin,
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
