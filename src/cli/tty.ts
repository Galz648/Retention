import { fstatSync } from "node:fs"
import { isatty } from "node:tty"

const S_IFMT = 0o170000
const S_IFCHR = 0o020000

export const fdIsTerminal = (fd: number): boolean => {
  try {
    if (isatty(fd)) return true
  } catch {
    // Bun compile may throw or lie; fall through to fstat.
  }
  try {
    return (fstatSync(fd).mode & S_IFMT) === S_IFCHR
  } catch {
    return false
  }
}

export const detectTty = (input: {
  readonly stdinTty?: boolean | undefined
  readonly stdoutTty?: boolean | undefined
  readonly stdinFd?: number | undefined
  readonly stdoutFd?: number | undefined
}): { readonly stdin: boolean; readonly stdout: boolean } => {
  const stdin =
    input.stdinTty === true ||
    (input.stdinFd !== undefined && fdIsTerminal(input.stdinFd))
  const stdout =
    input.stdoutTty === true ||
    (input.stdoutFd !== undefined && fdIsTerminal(input.stdoutFd))
  return { stdin, stdout }
}
