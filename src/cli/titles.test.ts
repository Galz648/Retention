import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { TreeId } from "../domain/ids.ts"
import type { TreeListing } from "../domain/corpus.ts"
import { matchTitle, matchTrack, pickByNumber } from "./titles.ts"

const treeId = (s: string) => Schema.decodeUnknownSync(TreeId)(s)

const listing = (title: string, id: string): TreeListing => ({
  treeId: treeId(id),
  title,
  kind: "knowledge",
  track: "university",
  summary: "Test fixture.",
  archived: false,
  belongsTo: undefined,
  nodeCount: 1,
  cardCount: 1,
  edgeCount: 0,
})

const biology = listing("Biology II — seed tree", "biology-ii")
const cell = listing("Cell Biology — seed tree", "cell-biology")

describe("matchTrack", () => {
  test("university aliases", () => {
    expect(matchTrack("university")).toBe("university")
    expect(matchTrack("uni")).toBe("university")
    expect(matchTrack("1")).toBe("university")
    expect(matchTrack("course work")).toBe("university")
  })

  test("curiosity aliases", () => {
    expect(matchTrack("curiosity")).toBe("curiosity")
    expect(matchTrack("2")).toBe("curiosity")
    expect(matchTrack("personal research")).toBe("curiosity")
  })

  test("empty and unknown are undefined", () => {
    expect(matchTrack("")).toBeUndefined()
    expect(matchTrack("biology")).toBeUndefined()
  })
})

describe("matchTitle", () => {
  test("exact title wins", () => {
    expect(matchTitle([biology, cell], "Biology II — seed tree")).toEqual([
      biology,
    ])
  })

  test("unique prefix matches", () => {
    expect(matchTitle([biology, cell], "Bio")).toEqual([biology])
  })

  test("ambiguous prefix returns all hits", () => {
    const biologyI = listing("Biology I — seed tree", "biology-i")
    expect(matchTitle([biology, biologyI], "Biology")).toEqual([biology, biologyI])
  })
})

describe("pickByNumber", () => {
  test("1-based index into the listed order", () => {
    expect(pickByNumber([biology, cell], "2")).toEqual(cell)
    expect(pickByNumber([biology, cell], "0")).toBeUndefined()
  })
})
