import type { TreeListing } from "../domain/corpus.ts"

const commands: ReadonlyArray<{ readonly name: string; readonly hint: string }> = [
  { name: "help", hint: "what you can do" },
  { name: "status", hint: "whether a log exists; which tree if you named one" },
  { name: "trees", hint: "every tree, by kind, with a one-line what-it-is" },
  { name: "tree", hint: "one tree: nodes and edges" },
  { name: "show", hint: "one due card including the answer / must-hits" },
  { name: "queue", hint: "due and unblocked cards, numbered" },
  { name: "grade", hint: "append one review — asks first" },
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
    queue|tree|status)
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
    queue|tree|status)
      COMPREPLY=( $(compgen -W ${JSON.stringify(titleWords)} -- "$cur") )
      ;;
    grade)
      COMPREPLY=( $(compgen -W "Again Hard Good Easy ${titleWords}" -- "$cur") )
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
