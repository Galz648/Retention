Session CLI (frontend) — impure as a component (it talks to Session and the filesystem). Individual **commands** are classified for the user as **pure** (read-only) or **impure** (create / append / move / delete).

Does: drive inspect, review, and capture from one installed command. Name trees, show cards, print the queue, record a grade after consent, append an inbox note after consent.
Does not: hold state, compute Brightness, decide due-ness, walk prerequisites, or create nodes. Does not require the user to set environment variables or open data files. Does not run curation.

## Product surface

The command-line program is the only user-facing client in this version. All interaction goes through it.

- One command you can type: **`retention`**. Not `bun src/cli/main.ts`. Not environment-variable wrappers.
- No user-facing environment variables.
- Paths (corpus directory, event log) are owned by the program. The user never has to know them. Inspect commands print what they need in glossary language.
- **You can see every tree** by title. Folder names are not how you refer to trees.
- **Each invocation chooses a tree** (title argument or picker). A run is not glued to one tree from startup.
- **Writes wait for a yes.** Impure commands ask; default no. Help (and the program with no args) lists every command, each marked `[pure]` or `[impure]`, each with a one-line description of what it does.
- **Cool must not hide the job.** Color, a banner, completions, and arrow-key select are allowed only when they make the next action clearer. Piped output stays plain text, no color, no banner.

## Pure vs impure

**Pure** = does not create, append, move, or delete anything. Reads of trees and the event log are allowed. Missing log = empty history, and the file is not created.

**Impure** = any write. Must state what will happen, then ask permission, then wait. Default is no. No write without an explicit yes.

If the program cannot ask a yes/no question (input is piped, not an interactive terminal), an impure command **refuses** rather than writing. There is no `--yes` in this version.

Creating the log (or its directory) counts as a side effect. `queue` on a missing log must not create anything.

## Commands (this version)

```
[pure]    help     what you can do
[pure]    status   whether a log exists; which tree if you named one
[pure]    trees    every tree, by kind, with a one-line what-it-is
[pure]    tree     one tree's nodes and edges
[pure]    show     one due card including the answer / must-hits
[pure]    queue    due and unblocked cards, numbered
[pure]    inbox    captured notes waiting for curation
[impure]  grade    append one review — asks first
[impure]  capture  append one inbox note — asks first
```

Unknown command: print help, exit non-zero.

Numbers refer to the current queue for that tree (see `queue`), not to internal card ids.

When a command runs, the first line restates that description in context (`queue — due cards for Biology II`). Then the payload.

### `help`

Print the banner (TTY only), then the list above. Each line carries `[pure]` or `[impure]` and the description. Impure entries note that they ask first. Use glossary words, not folder names.

Interactive terminal, no args: same help, then a **select** of commands (arrow keys / number). Choosing one runs it (and may ask for a tree next). Piped input: help text only, no select.

### `status`

Orient without opening files: whether a log exists, which tree is in play if one was chosen. Do not print paths unless we later add an explicit verbose mode (parked). Read-only.

### `trees`

A **short** list you can scan. Not node/card/edge counts — those belong on `tree`.

Group by kind, each row: **title** and one sentence of what it is.

```
Knowledge trees — concepts and what depends on what
  Biology II          animal systems and ecology, from the course map
  Cell Biology        Cooper-scale cell biology map

Term decks — names and conventions to recall
  Biology II ecology terms
  German frequency    core words, first slice
```

Archived trees in a third group, or omitted until we have any.

Folder names never appear. Importer leftovers (`seed tree`, `Term Drill State — …`) are not the titles the person sees — the listing uses the human title (see GAPS for the rename table).

Interactive `trees`: the list is a **select**. Entering a row prints that one-liner again and the title you can pass to `queue` / `tree`. It does not dump every node.

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

### `inbox`

Pending captured notes, numbered, raw text. `inbox empty` if none. Does not write. No folder names, paths, or event tags.

### `capture …` (impure)

The rest of the command line is the note. If omitted in an interactive terminal, ask `Capture what?`. Empty text is not a write.

Before writing, print a consent line:

- the note (truncated if long)
- that this **appends one inbox note** to the event log
- if the log does not exist, that this **will create it**

Then `Proceed? [y/N]`. Same yes/no rules as `grade`. Capture is not bound to a tree.

## Choosing a tree

`[title]` is the tree's **title** (`Biology II`, `Biology II ecology terms`, …), or a unique prefix of that title.

If omitted in an interactive terminal: a **select** of titles (grouped as in `trees`), not a wall of counts. That prompt is not a write.
If omitted and the program cannot ask: error, print the compact title list, exit non-zero.
If the prefix matches more than one title: select among the matches, or error the same way when not interactive.

## Feel (TTY)

Useful first. Decoration second.

- **Banner:** the existing Retention wordmark, **only** on `help` (and the no-args select). Never on `queue` / `show` / `grade` / `inbox` / `capture`.
- **Color:** when stdout is a terminal. None when piped. Honor `NO_COLOR`. Impure / “this will write” uses a distinct color from pure lists. Do not rainbow every line.
- **Completions:** generate shell completions for commands, ratings, and tree **titles** (`retention completions zsh` or equivalent). Typing `retention queue <tab>` offers titles, not folder names.
- **Select:** arrow keys (and numbers) for command, tree, queue index, and rating when those arguments are omitted on a TTY. Typing the argument still works and is the non-interactive path.

## Client language (open)

The engine stays TypeScript / Effect. The **client** may stay a Bun-compiled TypeScript binary, or move to Rust, if the TypeScript ecosystem cannot deliver this feel without fighting the compiler (completions, color, select, one artifact).

That is **not decided**. Decide after a first pass at the feel in the current client, not before. A Rust client would still speak the same commands and consent rules; it would not reimplement mastery / graph / scheduler.

## Binary

TypeScript's compiler emits JavaScript, not a native binary.

This repo runs on Bun. This version ships a **standalone executable** via Bun compile (runtime + the program in one file). The user runs the named command. How the binary was produced is not part of the daily interface.

Until that artifact exists, `bun src/cli/main.ts` may be the developer stand-in — same arguments, same help, same consent. It is not the product.

## Does not (parked)

Interactive review loop, curation, `--yes`, environment-variable config, opening or requiring the user to edit log or corpus files, showing folder names or card ids as the way to talk.
