import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { TreeId } from "../domain/ids.ts"
import type { TreeListing } from "../domain/corpus.ts"
import { formatTreesList } from "./trees-view.ts"

const treeId = (s: string) => Schema.decodeUnknownSync(TreeId)(s)

const listing = (
  title: string,
  kind: "knowledge" | "terms",
  summary: string,
  id: string,
): TreeListing => ({
  treeId: treeId(id),
  title,
  kind,
  summary,
  archived: false,
  nodeCount: 99,
  cardCount: 99,
  edgeCount: 99,
})

describe("formatTreesList", () => {
  test("groups knowledge vs terms, shows title and summary, omits counts", () => {
    const text = formatTreesList([
      listing("Biology II", "knowledge", "Animal systems and ecology, from the course map.", "biology-ii"),
      listing("Biology II ecology terms", "terms", "Names and conventions from ecology.", "terms-biology-ii-ecology"),
    ])
    expect(text).toContain("Knowledge trees")
    expect(text).toContain("Term decks")
    expect(text).toContain("Biology II")
    expect(text).toContain("Animal systems and ecology")
    expect(text).toContain("Biology II ecology terms")
    expect(text).not.toContain("99")
    expect(text).not.toContain("nodes")
    expect(text).not.toContain("biology-ii")
  })
})
