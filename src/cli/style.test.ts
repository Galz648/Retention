import { describe, expect, test } from "bun:test"
import { colorEnabled, palette } from "./style.ts"

describe("palette", () => {
  test("disabled palette never emits ANSI", () => {
    const ink = palette(false)
    expect(ink.warn("hello")).toBe("hello")
    expect(ink.heading("x")).toBe("x")
    expect(ink.warn("hello")).not.toContain("\u001b")
  })

  test("enabled palette wraps warn", () => {
    const ink = palette(true)
    expect(ink.warn("no")).toContain("\u001b")
    expect(ink.warn("no")).toContain("no")
  })

  test("NO_COLOR or non-tty disables color", () => {
    expect(colorEnabled({ stdoutTty: true, noColor: true })).toBe(false)
    expect(colorEnabled({ stdoutTty: false, noColor: false })).toBe(false)
    expect(colorEnabled({ stdoutTty: true, noColor: false })).toBe(true)
  })
})
