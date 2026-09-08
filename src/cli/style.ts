const RESET = "\u001b[0m"
const CYAN = "\u001b[36m"
const YELLOW = "\u001b[33m"
const DIM = "\u001b[2m"
const BOLD = "\u001b[1m"

export type Palette = {
  readonly enabled: boolean
  readonly heading: (text: string) => string
  readonly warn: (text: string) => string
  readonly dim: (text: string) => string
  readonly bold: (text: string) => string
}

const paint = (enabled: boolean, code: string, text: string): string =>
  enabled ? `${code}${text}${RESET}` : text

export const palette = (enabled: boolean): Palette => ({
  enabled,
  heading: (text) => paint(enabled, CYAN, text),
  warn: (text) => paint(enabled, YELLOW, text),
  dim: (text) => paint(enabled, DIM, text),
  bold: (text) => paint(enabled, BOLD, text),
})

export const colorEnabled = (input: {
  readonly stdoutTty: boolean
  readonly noColor: boolean
}): boolean => input.stdoutTty && !input.noColor
