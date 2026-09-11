import { describe, expect, test } from "bun:test"
import { colorEnabled, palette } from "./style.ts"

describe("palette", () => {
  test("disabled palette never emits ANSI", () => {
    const ink = palette(false)
    expect(ink.warn("hello")).toBe("hello")
    expect(ink.heading("x")).toBe("x")
    expect(ink.warn("hello")).not.toContain("\u001b")
    expect(ink.knowledge("k")).toBe("k")
    expect(ink.terms("t")).toBe("t")
  })

  test("enabled palette wraps warn and kind colors", () => {
    const ink = palette(true)
    expect(ink.warn("no")).toContain("\u001b")
    expect(ink.warn("no")).toContain("no")
    expect(ink.knowledge("k")).toContain("\u001b[36m")
    expect(ink.terms("t")).toContain("\u001b[35m")
    expect(ink.due("d")).toContain("\u001b[32m")
  })

  test("NO_COLOR or non-tty disables color", () => {
    expect(colorEnabled({ tty: true, noColor: true })).toBe(false)
    expect(colorEnabled({ tty: false, noColor: false })).toBe(false)
    expect(colorEnabled({ tty: true, noColor: false })).toBe(true)
  })
})
