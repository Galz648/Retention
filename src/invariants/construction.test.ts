import { readdir } from "node:fs/promises"
import { describe, expect, test } from "bun:test"

/** Top-level `src/` kinds. A new directory fails until it is classified here. */
const knownTopLevel = new Set([
  "cli",
  "session",
  "engine",
  "store",
  "corpus",
  "codec",
  "domain",
  "testing",
  "invariants",
  "events",
  "inbox",
])

const listTopLevel = async (): Promise<ReadonlyArray<string>> => {
  const entries = await readdir("src", { withFileTypes: true })
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
}

const listEngineDirs = async (): Promise<ReadonlyArray<string>> => {
  try {
    const entries = await readdir("src/engine", { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : ""
    if (code === "ENOENT") return []
    throw error
  }
}

const sourceOf = async (globPattern: string): Promise<Array<{ path: string; text: string }>> => {
  const glob = new Bun.Glob(globPattern)
  const files: Array<{ path: string; text: string }> = []
  for await (const path of glob.scan(".")) {
    files.push({ path, text: await Bun.file(path).text() })
  }
  return files
}

describe("construction", () => {
  test("INV-C-MOD-01: every src top-level dir is on the kind registry", async () => {
    const dirs = await listTopLevel()
    expect(dirs.length).toBeGreaterThan(0)
    for (const dir of dirs) {
      expect(knownTopLevel.has(dir)).toBe(true)
    }
  })

  test("INV-C-ENG-01: engine Tags never import each other", async () => {
    const names = await listEngineDirs()
    const sources: Record<string, string> = {}
    for (const name of names) {
      const files = await sourceOf(`src/engine/${name}/**/*.ts`)
      sources[name] = files.map((file) => file.text).join("\n")
    }
    for (const name of names) {
      for (const other of names) {
        if (name === other) continue
        expect(sources[name] ?? "").not.toMatch(new RegExp(`engine/${other}`))
      }
    }
  })

  test("INV-C-ENG-02: engine source does not import store, corpus, session, cli, or inbox", async () => {
    const files = await sourceOf("src/engine/**/*.ts")
    const seams = ["store", "corpus", "session", "cli", "inbox"] as const
    for (const file of files) {
      if (file.path.endsWith(".test.ts")) continue
      for (const seam of seams) {
        expect(file.text).not.toMatch(
          new RegExp(
            `from ["'](?:[^"']*src/|(?:\\.\\./)+)${seam}(?:/|"|\\.ts)`,
          ),
        )
      }
    }
  })

  test("INV-C-MOD-01: each engine Live has FastCheck and an INV-B- test name", async () => {
    const lives = await sourceOf("src/engine/*/live.ts")
    for (const live of lives) {
      const testPath = live.path.replace(/live\.ts$/, "live.test.ts")
      const file = Bun.file(testPath)
      expect(await file.exists()).toBe(true)
      const text = await file.text()
      expect(text).toMatch(/from ["']effect\/FastCheck["']/)
      expect(text).toMatch(/test\(["']INV-B-/)
    }
  })

  test("INV-C-CLI-01: CLI sources do not import engine Tags or THRESHOLD", async () => {
    const files = await sourceOf("src/cli/**/*.ts")
    for (const file of files) {
      if (file.path.endsWith(".test.ts")) continue
      if (/src\/cli\/(mastery|graph|scheduler)\.ts$/.test(file.path)) continue
      expect(file.text).not.toMatch(/from ["'][^"']*engine\//)
      expect(file.text).not.toMatch(/THRESHOLD/)
    }
  })

  test("INV-C-CLI-03: isolated engine command modules import at most one Tag", async () => {
    const commandFiles = [
      "src/cli/mastery.ts",
      "src/cli/graph.ts",
      "src/cli/scheduler.ts",
    ]
    for (const path of commandFiles) {
      const file = Bun.file(path)
      if (!(await file.exists())) continue
      const text = await file.text()
      const tags = [
        /engine\/mastery/.test(text),
        /engine\/graph/.test(text),
        /engine\/scheduler/.test(text),
      ].filter(Boolean)
      expect(tags.length).toBeLessThanOrEqual(1)
    }
  })

  test("INV-C-INB-01: inbox does not import engine, session, cli, or THRESHOLD", async () => {
    const files = await sourceOf("src/inbox/**/*.ts")
    for (const file of files) {
      if (file.path.endsWith(".test.ts")) continue
      expect(file.text).not.toMatch(/from ["'][^"']*engine\//)
      expect(file.text).not.toMatch(/from ["'][^"']*session\//)
      expect(file.text).not.toMatch(/from ["'][^"']*cli\//)
      expect(file.text).not.toMatch(/THRESHOLD/)
    }
  })

  test("INV-C-CLI-02: src/cli has no --yes", async () => {
    const files = await sourceOf("src/cli/**/*.ts")
    for (const file of files) {
      expect(file.text).not.toMatch(/--yes/)
    }
  })

  test("INV-B-CLI-01: RETENTION_ is not used to pick tree or paths", async () => {
    const files = await sourceOf("src/**/*.ts")
    for (const file of files) {
      if (file.path.endsWith(".test.ts")) continue
      expect(file.text).not.toMatch(/RETENTION_/)
    }
  })
})
