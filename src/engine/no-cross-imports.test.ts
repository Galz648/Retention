import { describe, expect, test } from "bun:test"

const engineNames = ["mastery", "graph", "scheduler"] as const

const sourceOf = async (dir: string): Promise<string> => {
  const glob = new Bun.Glob(`src/engine/${dir}/**/*.ts`)
  const chunks: Array<string> = []
  for await (const path of glob.scan(".")) {
    chunks.push(await Bun.file(path).text())
  }
  return chunks.join("\n")
}

describe("engine isolation", () => {
  test("mastery, graph, and scheduler never import each other", async () => {
    const sources = {
      mastery: await sourceOf("mastery"),
      graph: await sourceOf("graph"),
      scheduler: await sourceOf("scheduler"),
    }
    for (const name of engineNames) {
      for (const other of engineNames) {
        if (name === other) continue
        expect(sources[name]).not.toMatch(new RegExp(`engine/${other}`))
      }
    }
  })

  test("engine never imports store, corpus I/O, session, or cli", async () => {
    const glob = new Bun.Glob("src/engine/**/*.ts")
    for await (const path of glob.scan(".")) {
      if (path.endsWith(".test.ts")) continue
      const text = await Bun.file(path).text()
      expect(text).not.toMatch(/from ["'][^"']*src\/store/)
      expect(text).not.toMatch(/from ["'][^"']*src\/corpus/)
      expect(text).not.toMatch(/from ["'][^"']*src\/session/)
      expect(text).not.toMatch(/from ["'][^"']*src\/cli/)
    }
  })

  test("mastery Live never provides Clock", async () => {
    const glob = new Bun.Glob("src/engine/mastery/**/*.ts")
    for await (const path of glob.scan(".")) {
      if (path.endsWith("interface.ts") || path.endsWith(".test.ts")) continue
      const text = await Bun.file(path).text()
      expect(text).not.toMatch(/ClockAt/)
      expect(text).not.toMatch(/TestClock/)
      expect(text).not.toMatch(/Layer\.succeed\(\s*Clock/)
      expect(text).not.toMatch(/provideService\(\s*Clock/)
      expect(text).not.toMatch(/Clock\.make\(/)
    }
  })
})
