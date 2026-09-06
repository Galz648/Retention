import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect, Schema } from "effect"
import { describe, expect, test } from "bun:test"
import { Record, Store } from "./interface.ts"
import { Live } from "./jsonl.ts"

const record = (s: string): Record => Schema.decodeUnknownSync(Record)(s)

const withJsonl = <A, E>(path: string, effect: Effect.Effect<A, E, Store>) =>
  Effect.runPromise(effect.pipe(Effect.provide(Live(path))))

const failJsonl = <E>(path: string, effect: Effect.Effect<unknown, E, Store>) =>
  withJsonl(path, Effect.flip(effect))

describe("Store.Live JSONL", () => {
  test("missing file is empty history", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nth-store-"))
    const path = join(dir, "log.jsonl")
    const state = await withJsonl(
      path,
      Effect.gen(function* () {
        const store = yield* Store
        return yield* store.read()
      }),
    )
    expect(state.records).toEqual([])
    expect("unterminated" in state).toBe(false)
  })

  test("append writes payload plus newline; read returns opaque lines", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nth-store-"))
    const path = join(dir, "log.jsonl")
    const a = record("{not json")
    const b = record(`{"ok":true}`)
    const state = await withJsonl(
      path,
      Effect.gen(function* () {
        const store = yield* Store
        yield* store.append(a)
        yield* store.append(b)
        return yield* store.read()
      }),
    )
    expect(state.records).toEqual([a, b])
    expect("unterminated" in state).toBe(false)
    const file = await Bun.file(path).text()
    expect(file).toBe("{not json\n{\"ok\":true}\n")
  })

  test("torn tail is unterminated on success; earlier lines stay history", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nth-store-"))
    const path = join(dir, "log.jsonl")
    await writeFile(path, "complete\n{\"torn\":", "utf8")
    const state = await withJsonl(
      path,
      Effect.gen(function* () {
        const store = yield* Store
        return yield* store.read()
      }),
    )
    expect(state.records).toEqual([record("complete")])
    expect(state.unterminated).toBe("{\"torn\":")
  })

  test("legal last value without a trailing newline is unterminated, not a failed read", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nth-store-"))
    const path = join(dir, "log.jsonl")
    await writeFile(path, `{"a":1}`, "utf8")
    const state = await withJsonl(
      path,
      Effect.gen(function* () {
        const store = yield* Store
        return yield* store.read()
      }),
    )
    expect(state.records).toEqual([])
    expect(state.unterminated).toBe(`{"a":1}`)
  })

  test("BOM is InvalidUtf8", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nth-store-"))
    const path = join(dir, "log.jsonl")
    await writeFile(path, Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d, 0x0a]))
    await expect(
      failJsonl(
        path,
        Effect.gen(function* () {
          const store = yield* Store
          return yield* store.read()
        }),
      ),
    ).resolves.toMatchObject({ _tag: "InvalidUtf8", path })
  })

  test("invalid UTF-8 is InvalidUtf8", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nth-store-"))
    const path = join(dir, "log.jsonl")
    await writeFile(path, Buffer.from([0xff, 0xfe, 0x00]))
    await expect(
      failJsonl(
        path,
        Effect.gen(function* () {
          const store = yield* Store
          return yield* store.read()
        }),
      ),
    ).resolves.toMatchObject({ _tag: "InvalidUtf8", path })
  })

  test("reading a directory is IsDirectory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nth-store-"))
    await expect(
      failJsonl(
        dir,
        Effect.gen(function* () {
          const store = yield* Store
          return yield* store.read()
        }),
      ),
    ).resolves.toMatchObject({ _tag: "IsDirectory", path: dir })
  })

  test("append into a missing parent is NotFound", async () => {
    const path = join(tmpdir(), "nth-missing-parent", "nope", "log.jsonl")
    await expect(
      failJsonl(
        path,
        Effect.gen(function* () {
          const store = yield* Store
          return yield* store.append(record("{}"))
        }),
      ),
    ).resolves.toMatchObject({ _tag: "NotFound", path })
  })

  test("empty existing file is empty history", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nth-store-"))
    const path = join(dir, "log.jsonl")
    await mkdir(dir, { recursive: true })
    await writeFile(path, "")
    const state = await withJsonl(
      path,
      Effect.gen(function* () {
        const store = yield* Store
        return yield* store.read()
      }),
    )
    expect(state.records).toEqual([])
  })
})
