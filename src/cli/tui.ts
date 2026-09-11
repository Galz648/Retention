import { Effect } from "effect"

export const ENTER_ALT = "\u001b[?1049h\u001b[?25l"
export const LEAVE_ALT = "\u001b[?25h\u001b[?1049l"
export const CLEAR = "\u001b[2J\u001b[H"
const INVERSE = "\u001b[7m"
const RESET = "\u001b[0m"

export type Key =
  | { readonly _tag: "up" }
  | { readonly _tag: "down" }
  | { readonly _tag: "enter" }
  | { readonly _tag: "back" }
  | { readonly _tag: "quit" }
  | { readonly _tag: "yes" }
  | { readonly _tag: "no" }
  | { readonly _tag: "unknown" }

const decode = (chunk: Uint8Array | string): string => {
  if (typeof chunk === "string") return chunk
  return new (
    globalThis as unknown as { TextDecoder: new () => { decode: (bytes: Uint8Array) => string } }
  ).TextDecoder().decode(chunk)
}

export const parseKeys = (chunk: Uint8Array | string): ReadonlyArray<Key> => {
  const text = decode(chunk)
  const keys: Array<Key> = []
  let i = 0
  while (i < text.length) {
    if (text[i] === "\u001b") {
      const rest = text.slice(i)
      if (rest.startsWith("\u001b[A") || rest.startsWith("\u001bOA")) {
        keys.push({ _tag: "up" })
        i += 3
        continue
      }
      if (rest.startsWith("\u001b[B") || rest.startsWith("\u001bOB")) {
        keys.push({ _tag: "down" })
        i += 3
        continue
      }
      keys.push({ _tag: "back" })
      i += 1
      continue
    }
    const ch = text[i]
    if (ch === "\u0003") {
      keys.push({ _tag: "quit" })
      i += 1
      continue
    }
    if (ch === "\r") {
      keys.push({ _tag: "enter" })
      i += text[i + 1] === "\n" ? 2 : 1
      continue
    }
    if (ch === "\n") {
      keys.push({ _tag: "enter" })
      i += 1
      continue
    }
    if (ch === "q" || ch === "Q") keys.push({ _tag: "quit" })
    else if (ch === "b" || ch === "B") keys.push({ _tag: "back" })
    else if (ch === "k" || ch === "K") keys.push({ _tag: "up" })
    else if (ch === "j" || ch === "J") keys.push({ _tag: "down" })
    else if (ch === "y" || ch === "Y") keys.push({ _tag: "yes" })
    else if (ch === "n" || ch === "N") keys.push({ _tag: "no" })
    i += 1
  }
  return keys
}

export const parseKey = (chunk: Uint8Array | string): Key =>
  parseKeys(chunk)[0] ?? { _tag: "unknown" }

export const moveCursor = (
  key: Key,
  cursor: number,
  length: number,
): number => {
  if (length <= 0) return 0
  if (key._tag === "up") return (cursor + length - 1) % length
  if (key._tag === "down") return (cursor + 1) % length
  return Math.min(cursor, length - 1)
}

export const highlight = (enabled: boolean, selected: boolean, line: string): string => {
  if (!selected) return line
  if (!enabled) return `> ${line}`
  return `${INVERSE}${line}${RESET}`
}

export const renderScreen = (input: {
  readonly crumbs: string
  readonly rows: ReadonlyArray<string>
  readonly cursor: number
  readonly color: boolean
  readonly footer: string
}): string => {
  const painted = input.rows.map((row, index) =>
    highlight(input.color, index === input.cursor && input.rows.length > 0, row),
  )
  const body = painted.length === 0 ? ["nothing here"] : painted
  return [CLEAR, input.crumbs, ...body, input.footer].join("\n")
}

export const withAlternateScreen = <A, E, R>(
  write: (text: string) => void,
  body: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      write(ENTER_ALT)
    }),
    () => body,
    () =>
      Effect.sync(() => {
        write(LEAVE_ALT)
      }),
  )

type RawStdin = {
  readonly setRawMode?: (value: boolean) => void
}

export const withRawMode = <A, E, R>(
  stdin: RawStdin,
  body: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      stdin.setRawMode?.(true)
    }),
    () => body,
    () =>
      Effect.sync(() => {
        stdin.setRawMode?.(false)
      }),
  )

type ReadSync = (fd: number, buffer: Uint8Array) => number

export const readKeySync =
  (read: ReadSync, fd = 0): (() => Effect.Effect<Key>) => {
    const pending: Array<Key> = []
    return () =>
      Effect.sync(() => {
        const queued = pending.shift()
        if (queued !== undefined) return queued
        const buffer = new Uint8Array(32)
        const n = read(fd, buffer)
        if (n <= 0) return { _tag: "quit" as const }
        const keys = parseKeys(buffer.subarray(0, n))
        if (keys.length === 0) return { _tag: "unknown" as const }
        const first = keys[0]
        pending.push(...keys.slice(1))
        return first ?? { _tag: "unknown" as const }
      })
  }

export const installTerminalRestore = (
  write: (text: string) => void,
  stdin: RawStdin,
  on: (event: "SIGINT" | "SIGTERM", fn: () => void) => void,
): (() => void) => {
  let armed = true
  const restore = () => {
    if (!armed) return
    armed = false
    write(LEAVE_ALT)
    stdin.setRawMode?.(false)
  }
  on("SIGINT", restore)
  on("SIGTERM", restore)
  return restore
}
