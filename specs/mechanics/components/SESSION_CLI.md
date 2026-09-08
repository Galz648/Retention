Session CLI (frontend) — impure as a component (it talks to Session and the filesystem). Individual **commands** are classified for the user as **pure** (read-only) or **impure** (create / append / move / delete).

Does: drive inspect and review from one installed command. Name trees, show cards, print the queue, record a grade after consent.
Does not: hold state, compute Brightness, decide due-ness, walk prerequisites, or create nodes. Does not require the user to set environment variables or open data files.

## Product surface

The command-line program is the only user-facing client in this version. All interaction goes through it.

- One command you can type: **`retention`**. Not `bun src/cli/main.ts`. Not environment-variable wrappers.
- No user-facing environment variables.
- Paths (corpus directory, event log) are owned by the program. The user never has to know them. Inspect commands print what they need in glossary language.
- **You can see every tree** by title. Folder names are not how you refer to trees.
- **Each invocation chooses a tree** (title argument or picker). A run is not glued to one tree from startup.
- **Writes wait for a yes.** Impure commands ask; default no. Help (and the program with no args) lists every command, each marked `[pure]` or `[impure]`.

## Pure vs impure

**Pure** = does not create, append, move, or delete anything. Reads of trees and the event log are allowed. Missing log = empty history, and the file is not created.

**Impure** = any write. Must state what will happen, then ask permission, then wait. Default is no. No write without an explicit yes.

If the program cannot ask a yes/no question (input is piped, not an interactive terminal), an impure command **refuses** rather than writing. There is no `--yes` in this version.

Creating the log (or its directory) counts as a side effect. `queue` on a missing log must not create anything.

## Commands (this version)

```
[pure]    help
[pure]    status
[pure]    trees
[pure]    tree  [title]
[pure]    show  <number>  [title]
[pure]    queue [title]
[impure]  grade <number> <Again|Hard|Good|Easy> [title]
```

Unknown command: print help, exit non-zero.

Numbers refer to the current queue for that tree (see `queue`), not to internal card ids.

### `help`

Print the list above. Each line carries `[pure]` or `[impure]`. Impure entries note that they ask first. Use glossary words, not folder names.

### `status`

Orient without opening files: whether a log exists, which tree is in play if one was chosen. Do not print paths unless we later add an explicit verbose mode (parked). Read-only.

### `trees`

List every tree by **title**, plus how many nodes, cards, and edges, and whether it is archived. Folder names are omitted.

### `tree [title]`

One tree: title, archived or not, nodes with their titles and how many cards, edges as `from title → to title`. No folder names, no card ids.

### `show <number> [title]`

The card at that place in the current queue: type (recall / derivation), node title, prompt, and the answer (recall) or must-hits (derivation). Read-only. So a card is inspectable without opening files and without learning an id.

### `queue [title]`

Due ∩ eligible cards, recall then derivation, **numbered**. Each line: number, type, node title, prompt. No answers. No card ids. `queue empty` if none. Does not write.

### `grade …` (impure)

Before writing, print a consent line in glossary language:

- the card's prompt (and node title)
- the rating
- that this **appends one review** to the event log
- if the log does not exist, that this **will create it**

Then `Proceed? [y/N]`. Only `y` / `yes` (case-insensitive) continue. Anything else aborts with no write.

## Choosing a tree

`[title]` is the tree's **title** (`Biology II — seed tree`, …), or a unique prefix of that title.

If omitted in an interactive terminal: list titles, ask which one. That prompt is not a write.
If omitted and the program cannot ask: error, print the title list, exit non-zero.
If the prefix matches more than one title: list the matches, ask or error the same way.

## Binary

TypeScript's compiler emits JavaScript, not a native binary.

This repo runs on Bun. This version ships a **standalone executable** via Bun compile (runtime + the program in one file). The user runs the named command. How the binary was produced is not part of the daily interface.

Until that artifact exists, `bun src/cli/main.ts` may be the developer stand-in — same arguments, same help, same consent. It is not the product.

## Does not (parked)

Interactive review loop, capture, curation, `--yes`, environment-variable config, opening or requiring the user to edit log or corpus files, showing folder names or card ids as the way to talk.
