import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { TreeId } from "../domain/ids.ts"
import type { TreeListing } from "../domain/corpus.ts"
import { palette } from "./style.ts"
import { formatTreesList } from "./trees-view.ts"

const treeId = (s: string) => Schema.decodeUnknownSync(TreeId)(s)

const listing = (
  title: string,
  kind: "knowledge" | "terms",
  summary: string,
  id: string,
  belongsTo?: string,
  track: "university" | "curiosity" = "university",
): TreeListing => ({
  treeId: treeId(id),
  title,
  kind,
  track,
  summary,
  archived: false,
  belongsTo: belongsTo === undefined ? undefined : treeId(belongsTo),
  nodeCount: 99,
  cardCount: 99,
  edgeCount: 99,
})

const stripAnsi = (text: string): string => text.replace(/\u001b\[[0-9;]*m/g, "")

const dataLine = (text: string, title: string, summary: string): string => {
  const line = stripAnsi(text)
    .split("\n")
    .find((row) => row.includes(title) && row.includes(summary))
  if (line === undefined) throw new Error(`missing row ${title}`)
  return line
}

describe("formatTreesList", () => {
  test("groups by track, then nests attached decks under their knowledge tree", () => {
    const text = formatTreesList([
      listing("Biology II", "knowledge", "Animal systems and ecology, from the course map.", "biology-ii"),
      listing("Biology II ecology terms", "terms", "Names and conventions from ecology.", "terms-biology-ii-ecology", "biology-ii"),
      listing("Biology II cell terms", "terms", "Names from cell biology.", "terms-biology-ii-cell", "biology-ii"),
      listing("German frequency terms", "terms", "Core words, first slice.", "terms-german-frequency-core", undefined, "curiosity"),
    ])
    expect(text).toContain("University — course work")
    expect(text).toContain("Curiosity — personal research")
    expect(text).toContain("Knowledge trees")
    expect(text).toContain("Biology II")
    expect(text).toContain("Animal systems and ecology")
    expect(text).toContain("├─ Biology II cell terms")
    expect(text).toContain("└─ Biology II ecology terms")
    expect(text).toContain("Term decks — not attached to a knowledge tree")
    expect(text).toContain("German frequency terms")
    expect(text).not.toContain("99")
    expect(text).not.toContain("nodes")
    expect(text).not.toContain("biology-ii")
    const universityAt = text.indexOf("University — course work")
    const curiosityAt = text.indexOf("Curiosity — personal research")
    const ecologyAt = text.indexOf("Biology II ecology terms")
    const germanHead = text.indexOf("Term decks — not attached")
    expect(universityAt).toBeGreaterThanOrEqual(0)
    expect(curiosityAt).toBeGreaterThan(universityAt)
    expect(ecologyAt).toBeGreaterThan(universityAt)
    expect(ecologyAt).toBeLessThan(curiosityAt)
    expect(germanHead).toBeGreaterThan(curiosityAt)
    expect(text.indexOf("German frequency terms")).toBeGreaterThan(germanHead)
  })

  test("summaries share one column on knowledge rows", () => {
    const ink = palette(true)
    const text = formatTreesList(
      [
        listing("Hi", "knowledge", "first summary", "tree-hi"),
        listing("Hello World", "knowledge", "second summary", "tree-hello"),
      ],
      ink,
    )
    const short = dataLine(text, "Hi", "first summary")
    const long = dataLine(text, "Hello World", "second summary")
    expect(short.indexOf("first summary")).toBe(long.indexOf("second summary"))
    expect(text).not.toContain("99")
    expect(text).not.toContain("tree-hi")
  })

  test("kind colors titles when a palette is on", () => {
    const ink = palette(true)
    const text = formatTreesList(
      [
        listing("Biology II", "knowledge", "map", "biology-ii"),
        listing("German frequency terms", "terms", "words", "terms-german-frequency-core", undefined, "curiosity"),
      ],
      ink,
    )
    expect(text).toContain("\u001b[36mBiology II")
    expect(text).toContain("\u001b[35mGerman frequency terms")
    expect(text).not.toContain("biology-ii")
  })
})
