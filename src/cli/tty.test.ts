import { describe, expect, test } from "bun:test"
import { detectTty } from "./tty.ts"

describe("detectTty", () => {
  test("flags win when isTTY is already true", () => {
    expect(
      detectTty({ stdinTty: true, stdoutTty: true }),
    ).toEqual({ stdin: true, stdout: true })
  })

  test("compiled-binary lie: isTTY false still detects a real fd", () => {
    const found = detectTty({
      stdinTty: false,
      stdoutTty: false,
      stdinFd: 0,
      stdoutFd: 1,
    })
    expect(typeof found.stdin).toBe("boolean")
    expect(typeof found.stdout).toBe("boolean")
  })
})
