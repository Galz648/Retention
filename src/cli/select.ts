import { Effect } from "effect"

type Stdin = {
  readonly isTTY?: boolean
  readonly setRawMode?: (value: boolean) => void
  readonly resume: () => void
  readonly pause: () => void
  readonly on: (event: "data", fn: (chunk: Uint8Array | string) => void) => void
  readonly off: (event: "data", fn: (chunk: Uint8Array | string) => void) => void
}

type Stdout = {
  readonly write: (text: string) => void
}

const UP = "\u001b[A"
const DOWN = "\u001b[B"
const CLEAR = "\u001b[2K"
const HIDE = "\u001b[?25l"
const SHOW = "\u001b[?25h"

type WebGlobals = {
  readonly TextDecoder: new () => { decode: (bytes: Uint8Array) => string }
}

const decode = (chunk: Uint8Array | string): string => {
  if (typeof chunk === "string") return chunk
  return new (globalThis as unknown as WebGlobals).TextDecoder().decode(chunk)
}

export const liveSelect = (
  stdin: Stdin,
  stdout: Stdout,
): ((
  question: string,
  labels: ReadonlyArray<string>,
) => Effect.Effect<number | undefined>) =>
  (question, labels) =>
    Effect.tryPromise({
      try: async () => {
        if (stdin.isTTY !== true || stdin.setRawMode === undefined) {
          return undefined
        }
        if (labels.length === 0) return undefined
        let index = 0
        const draw = (first: boolean) => {
          if (!first) {
            stdout.write(`\u001b[${labels.length + 1}A`)
          }
          stdout.write(`${CLEAR}${question}\n`)
          labels.forEach((label, i) => {
            const mark = i === index ? ">" : " "
            stdout.write(`${CLEAR}${mark} ${label}\n`)
          })
        }
        stdin.setRawMode(true)
        stdin.resume()
        stdout.write(HIDE)
        draw(true)
        return await new Promise<number | undefined>((resolve) => {
          const onData = (chunk: Uint8Array | string) => {
            const text = decode(chunk)
            if (text === "\u0003") {
              finish(undefined)
              return
            }
            if (text === "\r" || text === "\n") {
              finish(index)
              return
            }
            if (text === UP || text === "k") {
              index = (index + labels.length - 1) % labels.length
              draw(false)
              return
            }
            if (text === DOWN || text === "j") {
              index = (index + 1) % labels.length
              draw(false)
              return
            }
            if (/^[1-9]$/.test(text)) {
              const next = Number(text) - 1
              if (next < labels.length) {
                finish(next)
              }
            }
          }
          const finish = (value: number | undefined) => {
            stdin.off("data", onData)
            stdin.setRawMode?.(false)
            stdin.pause()
            stdout.write(SHOW)
            resolve(value)
          }
          stdin.on("data", onData)
        })
      },
      catch: () => undefined,
    }).pipe(Effect.orElseSucceed(() => undefined))
