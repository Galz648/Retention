import { Effect } from "effect"
import { describe, expect, test } from "bun:test"
import {
  CLEAR,
  ENTER_ALT,
  LEAVE_ALT,
  highlight,
  moveCursor,
  parseKey,
  parseKeys,
  renderScreen,
  withAlternateScreen,
} from "./tui.ts"

describe("parseKey", () => {
  test("arrows, vim, enter, back, quit", () => {
    expect(parseKey("\u001b[A")._tag).toBe("up")
    expect(parseKey("k")._tag).toBe("up")
    expect(parseKey("\u001b[B")._tag).toBe("down")
    expect(parseKey("j")._tag).toBe("down")
    expect(parseKey("\r")._tag).toBe("enter")
    expect(parseKey("b")._tag).toBe("back")
    expect(parseKey("q")._tag).toBe("quit")
    expect(parseKey("\u0003")._tag).toBe("quit")
    expect(parseKey("q\n")._tag).toBe("quit")
    expect(parseKey("j\r")._tag).toBe("down")
    expect(parseKey("y")._tag).toBe("yes")
    expect(parseKey("n")._tag).toBe("no")
    expect(parseKey("x")._tag).toBe("unknown")
  })

  test("a cooked burst splits into separate keys", () => {
    expect(parseKeys("j\r\nbq\n").map((key) => key._tag)).toEqual([
      "down",
      "enter",
      "back",
      "quit",
      "enter",
    ])
  })
})

describe("moveCursor", () => {
  test("wraps", () => {
    expect(moveCursor({ _tag: "down" }, 0, 3)).toBe(1)
    expect(moveCursor({ _tag: "down" }, 2, 3)).toBe(0)
    expect(moveCursor({ _tag: "up" }, 0, 3)).toBe(2)
  })
})

describe("renderScreen", () => {
  test("clears and marks the cursor without ANSI when color is off", () => {
    const frame = renderScreen({
      crumbs: "session",
      rows: ["Biology II", "German"],
      cursor: 1,
      color: false,
      footer: "q quit",
    })
    expect(frame.startsWith(CLEAR)).toBe(true)
    expect(frame).toContain("session")
    expect(frame).toContain("> German")
    expect(frame).not.toContain("\u001b[7m")
  })

  test("inverts the cursor row when color is on", () => {
    const frame = renderScreen({
      crumbs: "session",
      rows: ["A", "B"],
      cursor: 0,
      color: true,
      footer: "q quit",
    })
    expect(frame).toContain("\u001b[7mA\u001b[0m")
  })
})

describe("highlight", () => {
  test("plain selected uses a prefix", () => {
    expect(highlight(false, true, "x")).toBe("> x")
    expect(highlight(false, false, "x")).toBe("x")
  })
})

describe("withAlternateScreen", () => {
  test("enters then leaves even when the body fails", async () => {
    const writes: Array<string> = []
    const failed = await Effect.runPromise(
      Effect.either(
        withAlternateScreen(
          (text) => writes.push(text),
          Effect.fail("boom"),
        ),
      ),
    )
    expect(failed._tag).toBe("Left")
    expect(writes[0]).toBe(ENTER_ALT)
    expect(writes[writes.length - 1]).toBe(LEAVE_ALT)
  })

  test("leaves after success", async () => {
    const writes: Array<string> = []
    await Effect.runPromise(
      withAlternateScreen(
        (text) => writes.push(text),
        Effect.sync(() => writes.push("body")),
      ),
    )
    expect(writes).toEqual([ENTER_ALT, "body", LEAVE_ALT])
  })
})
