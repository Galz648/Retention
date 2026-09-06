import { FileSystem } from "@effect/platform/FileSystem"
import { SystemError } from "@effect/platform/Error"
import { NodeFileSystem } from "@effect/platform-node"
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
  if (error instanceof SystemError) {
    if (error.reason === "PermissionDenied") {
      return new PermissionDenied({ path })
    }
    if (error.reason === "NotFound") {
      return new NotFound({ path })
    }
    if (error.reason === "BadResource" && code === "EISDIR") {
      return new IsDirectory({ path })
    }
  }
  return new IoError({ path, cause: error })
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
    return Effect.succeed(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  } catch {
    return Effect.fail(new InvalidUtf8({ path }))
  }
}

export const Live = (path: string): Layer.Layer<Store> =>
  Layer.effect(
    Store,
    Effect.gen(function* () {
      const fs = yield* FileSystem
      return Store.of({
        append: (record) =>
          fs
            .writeFile(path, new TextEncoder().encode(`${record}\n`), {
              flag: "a",
            })
            .pipe(Effect.mapError((error) => toStoreError(path, error))),
        read: () =>
          fs.readFile(path).pipe(
            Effect.flatMap((bytes) => decodeUtf8(path, bytes)),
            Effect.map(splitJsonl),
            Effect.catchAll((error) => {
              if (error instanceof InvalidUtf8) {
                return Effect.fail(error)
              }
              const mapped = toStoreError(path, error)
              if (mapped._tag === "NotFound") {
                return Effect.succeed({ records: [] as ReadonlyArray<Record> })
              }
              return Effect.fail(mapped)
            }),
          ),
      })
    }),
  ).pipe(Layer.provide(NodeFileSystem.layer))
