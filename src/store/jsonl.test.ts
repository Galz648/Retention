import { $ } from "bun"
import { Effect, Schema } from "effect"
import { describe, expect, test } from "bun:test"
import { Record, Store } from "./interface.ts"
import { Live } from "./jsonl.ts"

const record = (s: string): Record => Schema.decodeUnknownSync(Record)(s)

const withJsonl = <A, E>(path: string, effect: Effect.Effect<A, E, Store>) =>
  Effect.runPromise(effect.pipe(Effect.provide(Live(path))))

const failJsonl = <E>(path: string, effect: Effect.Effect<unknown, E, Store>) =>
  withJsonl(path, Effect.flip(effect))

const tempDir = async (): Promise<string> => {
  const dir = `${Bun.env.TMPDIR ?? "/tmp"}/nth-store-${crypto.randomUUID()}`
  await $`mkdir -p ${dir}`.quiet()
  return dir
}

describe("Store.Live JSONL", () => {
  test("missing file is empty history", async () => {
    const dir = await tempDir()
    const path = `${dir}/log.jsonl`
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
    const dir = await tempDir()
    const path = `${dir}/log.jsonl`
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
    const dir = await tempDir()
    const path = `${dir}/log.jsonl`
    await Bun.write(path, "complete\n{\"torn\":")
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
    const dir = await tempDir()
    const path = `${dir}/log.jsonl`
    await Bun.write(path, `{"a":1}`)
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
    const dir = await tempDir()
    const path = `${dir}/log.jsonl`
    await Bun.write(path, new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d, 0x0a]))
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
    const dir = await tempDir()
    const path = `${dir}/log.jsonl`
    await Bun.write(path, new Uint8Array([0xff, 0xfe, 0x00]))
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
    const dir = await tempDir()
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
    const path = `${Bun.env.TMPDIR ?? "/tmp"}/nth-missing-parent-${crypto.randomUUID()}/nope/log.jsonl`
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
    const dir = await tempDir()
    const path = `${dir}/log.jsonl`
    await Bun.write(path, "")
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
