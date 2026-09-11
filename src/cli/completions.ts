import type { TreeListing } from "../domain/corpus.ts"

const commands: ReadonlyArray<{ readonly name: string; readonly hint: string }> = [
  { name: "help", hint: "what you can do" },
  { name: "version", hint: "which build this is" },
  { name: "status", hint: "whether a log exists; which tree if you named one" },
  { name: "trees", hint: "every tree, by track then kind, with a one-line what-it-is" },
  { name: "session", hint: "options menu, then Session or the map; q quit" },
  { name: "mastery", hint: "brightness per card in one tree" },
  { name: "graph", hint: "eligible nodes if nothing is known, or full" },
  { name: "scheduler", hint: "due cards from a brightness probe" },
  { name: "show", hint: "one due card including the answer / must-hits" },
  { name: "queue", hint: "due and unblocked cards, numbered" },
  { name: "inbox", hint: "captured notes waiting for curation" },
  { name: "gaps", hint: "observed misses, titles not ids" },
  { name: "grade", hint: "append one review — asks first" },
  { name: "capture", hint: "append one inbox note — asks first" },
  { name: "gap", hint: "append one gap observation — asks first" },
  { name: "completions", hint: "shell completion script" },
]

const zshQuote = (value: string): string =>
  `'${value.replaceAll("'", `'\\''`)}'`

export const zshCompletions = (
  titles: ReadonlyArray<string>,
): string => {
  const titleWords = titles.map(zshQuote).join(" ")
  const commandLines = commands
    .map((command) => `    ${zshQuote(`${command.name}:${command.hint}`)}`)
    .join("\n")
  return `#compdef retention

_retention() {
  local -a commands
  commands=(
${commandLines}
  )
  local -a titles
  titles=(${titleWords})
  local -a ratings
  ratings=('Again' 'Hard' 'Good' 'Easy')

  case $words[2] in
    queue|status|mastery|session)
      _describe 'title' titles
      ;;
    graph|scheduler)
      _values 'probe' full
      _describe 'title' titles
      ;;
    show)
      _message 'queue number'
      _describe 'title' titles
      ;;
    grade)
      _message 'queue number'
      _describe 'rating' ratings
      _describe 'title' titles
      ;;
    gap)
      _message 'queue number'
      _values 'severity' core-error gap minor
      _describe 'title' titles
      ;;
    completions)
      _values 'shell' zsh bash
      ;;
    *)
      _describe 'command' commands
      ;;
  esac
}

compdef _retention retention
`
}

export const bashCompletions = (
  titles: ReadonlyArray<string>,
): string => {
  const titleWords = titles.map((title) => JSON.stringify(title)).join(" ")
  const commandNames = commands.map((command) => command.name).join(" ")
  return `_retention() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local cmd="\${COMP_WORDS[1]}"
  case "\${cmd}" in
    queue|status|mastery|session)
      COMPREPLY=( $(compgen -W ${JSON.stringify(titleWords)} -- "$cur") )
      ;;
    graph|scheduler)
      COMPREPLY=( $(compgen -W "full ${titleWords}" -- "$cur") )
      ;;
    grade)
      COMPREPLY=( $(compgen -W "Again Hard Good Easy ${titleWords}" -- "$cur") )
      ;;
    gap)
      COMPREPLY=( $(compgen -W "core-error gap minor ${titleWords}" -- "$cur") )
      ;;
    completions)
      COMPREPLY=( $(compgen -W "zsh bash" -- "$cur") )
      ;;
    *)
      COMPREPLY=( $(compgen -W "${commandNames}" -- "$cur") )
      ;;
  esac
}
complete -F _retention retention
`
}

export const completionsScript = (
  shell: string,
  listings: ReadonlyArray<TreeListing>,
): string | undefined => {
  const titles = listings.map((tree) => tree.title)
  if (shell === "zsh") return zshCompletions(titles)
  if (shell === "bash") return bashCompletions(titles)
  return undefined
}
