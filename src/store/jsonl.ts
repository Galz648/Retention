import { Effect, Layer, Schema } from "effect"
import {
  InvalidUtf8,
  IoError,
  IsDirectory,
  NoSpace,
  NotFound,
  PermissionDenied,
  Record,
  Store,
  type StoreError,
} from "./interface.ts"

type BunFileHandle = {
  readonly bytes: () => Promise<Uint8Array>
  readonly stat: () => Promise<{ readonly isDirectory: () => boolean }>
}

type BunSpawnResult = {
  readonly exited: Promise<number>
  readonly stderr: unknown
}

type BunRuntime = {
  readonly file: (path: string) => BunFileHandle
  readonly spawn: (
    command: ReadonlyArray<string>,
    options: {
      readonly stdin: Uint8Array
      readonly stdout: "ignore"
      readonly stderr: "pipe"
    },
  ) => BunSpawnResult
}

type WebGlobals = {
  readonly Bun: BunRuntime
  readonly TextEncoder: new () => { encode: (text: string) => Uint8Array }
  readonly TextDecoder: new (
    encoding: string,
    options: { fatal: boolean },
  ) => { decode: (bytes: Uint8Array) => string }
  readonly Response: new (body: unknown) => { text: () => Promise<string> }
}

const web = globalThis as unknown as WebGlobals
const bun = web.Bun

const asRecord = (line: string): Record => Schema.decodeUnknownSync(Record)(line)

const errnoOf = (error: unknown): string | undefined => {
  let current: unknown = error
  for (let i = 0; i < 5; i++) {
    if (current === null || typeof current !== "object") return undefined
    if ("code" in current && typeof current.code === "string") {
      return current.code
    }
    current = "cause" in current ? current.cause : undefined
  }
  return undefined
}

const toStoreError = (path: string, error: unknown): StoreError => {
  const code = errnoOf(error)
  if (code === "EACCES" || code === "EPERM") {
    return new PermissionDenied({ path })
  }
  if (code === "ENOENT") {
    return new NotFound({ path })
  }
  if (code === "EISDIR") {
    return new IsDirectory({ path })
  }
  if (code === "ENOSPC" || code === "EDQUOT" || code === "EFBIG") {
    return new NoSpace({ path })
  }
  return new IoError({ path, cause: error })
}

const isStoreError = (error: unknown): error is StoreError =>
  error instanceof PermissionDenied ||
  error instanceof NotFound ||
  error instanceof NoSpace ||
  error instanceof IsDirectory ||
  error instanceof InvalidUtf8 ||
  error instanceof IoError

const errorFromMessage = (path: string, message: string): StoreError | undefined => {
  const text = message.toLowerCase()
  if (text.includes("no such file") || text.includes("directory nonexistent")) {
    return new NotFound({ path })
  }
  if (text.includes("is a directory")) {
    return new IsDirectory({ path })
  }
  if (text.includes("permission denied")) {
    return new PermissionDenied({ path })
  }
  if (
    text.includes("no space") ||
    text.includes("quota exceeded") ||
    text.includes("file too large")
  ) {
    return new NoSpace({ path })
  }
  return undefined
}

const hasBom = (bytes: Uint8Array): boolean =>
  bytes.length >= 3 &&
  bytes[0] === 0xef &&
  bytes[1] === 0xbb &&
  bytes[2] === 0xbf

const splitJsonl = (
  text: string,
): {
  readonly records: ReadonlyArray<Record>
  readonly unterminated?: string
} => {
  const records: Array<Record> = []
  let start = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      let line = text.slice(start, i)
      if (line.endsWith("\r")) {
        line = line.slice(0, -1)
      }
      records.push(asRecord(line))
      start = i + 1
    }
  }
  if (start < text.length) {
    return { records, unterminated: text.slice(start) }
  }
  return { records }
}

const decodeUtf8 = (path: string, bytes: Uint8Array): Effect.Effect<string, InvalidUtf8> => {
  if (hasBom(bytes)) {
    return Effect.fail(new InvalidUtf8({ path }))
  }
  try {
    return Effect.succeed(new web.TextDecoder("utf-8", { fatal: true }).decode(bytes))
  } catch {
    return Effect.fail(new InvalidUtf8({ path }))
  }
}

const failureFromAppend = async (path: string, stderr: string): Promise<StoreError> => {
  const mapped = errorFromMessage(path, stderr)
  if (mapped !== undefined) return mapped
  try {
    const st = await bun.file(path).stat()
    if (st.isDirectory()) return new IsDirectory({ path })
    return new IoError({ path, cause: stderr })
  } catch (error) {
    return toStoreError(path, error)
  }
}

const appendRecord = (path: string, record: Record): Effect.Effect<void, StoreError> =>
  Effect.tryPromise({
    try: async () => {
      const payload = new web.TextEncoder().encode(`${record}\n`)
      const proc = bun.spawn(["/bin/sh", "-c", 'cat >> "$1"', "sh", path], {
        stdin: payload,
        stdout: "ignore",
        stderr: "pipe",
      })
      const exitCode = await proc.exited
      if (exitCode === 0) return
      const stderr = await new web.Response(proc.stderr).text()
      throw await failureFromAppend(path, stderr)
    },
    catch: (error) => (isStoreError(error) ? error : toStoreError(path, error)),
  })

const emptyHistory = {
  records: [] as ReadonlyArray<Record>,
}

const readRecords = (path: string) =>
  Effect.tryPromise({
    try: () => bun.file(path).bytes(),
    catch: (error) => toStoreError(path, error),
  }).pipe(
    Effect.flatMap((bytes) => decodeUtf8(path, bytes)),
    Effect.map(splitJsonl),
    Effect.catchTag("NotFound", () => Effect.succeed(emptyHistory)),
  )

export const Live = (path: string): Layer.Layer<Store> =>
  Layer.succeed(
    Store,
    Store.of({
      append: (record) => appendRecord(path, record),
      read: () => readRecords(path),
    }),
  )
