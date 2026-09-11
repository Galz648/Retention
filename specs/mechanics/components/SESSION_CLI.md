Session CLI (frontend) — impure as a component (it talks to Session and the filesystem). Individual **commands** are classified for the user as **pure** (read-only) or **impure** (create / append / move / delete). This is the Session component's surface: on a TTY, `session` is a fullscreen TUI until `q`. Home is an options menu. **Session** is the due queue, inspect, and grade with consent.

Does: drive inspect, review, capture, and gap observations from one installed command. TTY `session` occupies the terminal until `q`. Name trees, show cards, print the queue, record a grade after consent, append an inbox note after consent, append a gap observation after consent.
Does not: hold tree choice across process invocations, compute Brightness (that is `mastery` / Session.queue), decide due-ness, check eligibility, or create nodes. Does not require the user to set environment variables or open data files. Does not run the parked one-card review loop. Does not run curation.

## Product surface

The command-line program is the only user-facing client in this version. All interaction goes through it.

- One command you can type: **`retention`**. Not `bun src/cli/main.ts`. Not environment-variable wrappers.
- No user-facing environment variables.
- Paths (corpus directory, event log) are owned by the program. The user never has to know them. Inspect commands print what they need in glossary language.
- **You can see every tree** by title. Folder names are not how you refer to trees.
- **Each one-shot invocation chooses a tree** (title argument skips track; otherwise track then tree). A run is not glued to one tree from startup. The TUI walks trees until you quit; the next process starts clean.
- **Writes wait for a yes.** Impure commands ask; default no. Help lists every command, each marked `[pure]` or `[impure]`, each with a one-line description of what it does.
- **Cool must not hide the job.** Color, a banner, completions, and TUI chrome are allowed only when they make the next action clearer. Piped output stays plain text, no color, no banner, no alternate screen.

## Pure vs impure

**Pure** = does not create, append, move, or delete anything. Reads of trees and the event log are allowed. Missing log = empty history, and the file is not created.

**Impure** = any write. Must state what will happen, then ask permission, then wait. Default is no. No write without an explicit yes.

If the program cannot ask a yes/no question (input is piped, not an interactive terminal), an impure command **refuses** rather than writing. There is no `--yes` in this version.

Creating the log (or its directory) counts as a side effect. `queue` on a missing log must not create anything.

## Commands (this version)

```
[pure]    help         what you can do
[pure]    version      which build this is
[pure]    status       whether a log exists; which tree if you named one
[pure]    trees        every tree, by track then kind, with a one-line what-it-is
[pure]    session      options menu, then Session or the map; q quit
[pure]    mastery      Brightness per card (see MASTERY_CLI)
[pure]    graph        eligible and blocked nodes (see GRAPH_CLI)
[pure]    scheduler    due cards from a Brightness map (see SCHEDULER_CLI)
[pure]    show         one due card including the answer / must-hits
[pure]    queue        due and unblocked cards, numbered
[pure]    inbox        captured notes waiting for curation
[pure]    gaps         observed misses, titles not ids
[impure]  grade        append one review — asks first
[impure]  capture      append one inbox note — asks first
[impure]  gap          append one gap observation — asks first
[pure]    completions  shell completion script (zsh or bash)
```

`browse` is gone. The TUI is `session`.

Unknown command: print help, exit non-zero.

Numbers refer to the current queue for that tree (see `queue`), not to internal card ids.

When a command runs, the first line restates that description in context (`queue — due cards for Biology II`). Then the payload.

### `help`

Print the banner (TTY only), then `retention <version>`, then the list above. Each line carries `[pure]` or `[impure]` and the description. Impure entries note that they ask first. Use glossary words, not folder names.

`retention version`, `--version`, and `-V` print `retention <version>` only.

Piped input, or a non-interactive invocation with no args: help text only, no TUI, no picker.

### `session`

TTY-only **TUI**. This **is** the Session CLI. Interactive terminal, no args: the same TUI. Process does not return to the shell until `q`. The build version is on every TUI screen.

**Home is the options menu.** Highlight with `j`/`k` or arrows, `enter` to open, `b` back, `q` quit.

- **Session** — the actual session: pick a tree, due queue, enter to inspect (same payload as `show`), enter again to pick Again/Hard/Good/Easy, then consent (`Proceed?` default No; `y` writes, `n`/enter on No aborts). Not the parked one-card review loop.
- **Trees** — walk the map. Knowledge trees and unattached decks at the picker; attached decks hang under parents. Enter a tree: you-are-here path (`●` on the current node, children underneath), then roots and attached decks. Enter a node: cards, then dependents. Inspect a card from the map is not a grade.
- **Status** — whether a log exists.

**Alternate screen.** Entering `session` switches to the terminal's alternate screen. `q` (and crash/interrupt) restores the previous terminal. One-shot commands never enter this screen.

Optional `[title]` skips the picker and opens **Session** (the queue) for that tree.

Piped `session` prints the same nested list as piped `trees` and returns.

### `status`

Orient without opening files: whether a log exists, which tree is in play if one was chosen. Do not print paths unless we later add an explicit verbose mode (parked). Read-only.

### `trees`

A **scanable nested map**. Not node/card/edge counts — those belong in the TUI you-are-here path.

Titles in one column, the one-line what-it-is in a second column (pad so summaries start at the same index). Knowledge trees are the parents. Term decks that belong to a knowledge tree hang under them with tree branches (`├─` / `└─`). They remain separate trees with their own queues. Unattached decks (German, and any deck with no parent) sit in their own group.

```
Knowledge trees — concepts and what depends on what
Biology II                     animal systems and ecology, from the course map
└─ Biology II ecology terms    names and conventions from ecology
Cell Biology                   Cooper-scale cell biology map

Term decks — not attached to a knowledge tree
German frequency               core words, first slice
```

Archived trees in a third group, or omitted until we have any.

Folder names never appear. Importer leftovers (`seed tree`, `Term Drill State — …`) are not the titles the person sees — the listing uses the human title (see GAPS for the rename table).

Piped `trees` prints this list and returns. TTY `trees` enters the TUI on Trees (the map).

### `show <number> [title]`

The card at that place in the current queue: type (recall / derivation), node title, prompt, and the answer (recall) or must-hits (derivation). Read-only. So a card is inspectable without opening files and without learning an id.

### `queue [title]`

Due ∩ eligible cards, recall then derivation, **numbered**. Each line: number, type, node title, prompt. No answers. No card ids. `queue empty` if none. Does not write. Session CLI does not compute Brightness to build this list — Session.queue does.

### `mastery` / `graph` / `scheduler`

Isolated **pure** subcommands. Each talks to one engine Tag. The CLI module may load corpus and log; it must not import the other two engines. Session CLI does not compute Brightness itself.

See [MASTERY_CLI.md](./MASTERY_CLI.md), [GRAPH_CLI.md](./GRAPH_CLI.md), [SCHEDULER_CLI.md](./SCHEDULER_CLI.md).

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

### `gaps`

Pending gap observations, numbered. Tree title, node title, severity, sub-concept, then the observation. `gaps empty` if none. Does not write. No folder names, card ids, paths, or event tags.

### `gap …` (impure)

Identify the card like `grade` (queue number + tree title). Then severity (`core-error` | `gap` | `minor`), the missed sub-concept, and what was said or absent. If omitted in an interactive terminal, ask.

Before writing, print a consent line:

- the prompt, node title, sub-concept, and severity
- that this **appends one gap observation** to the event log
- if the log does not exist, that this **will create it**

Then `Proceed? [y/N]`. Same yes/no rules as `grade`.

## Choosing a tree

`[title]` is the tree's **title** (`Biology II`, `Biology II ecology terms`, …), or a unique prefix of that title. A title argument **skips the track**.

If omitted in an interactive terminal: **track, then tree**. Track is university (course work) or curiosity (personal research). Then a **picker** of titles on that track (grouped as in `trees`), not a wall of counts. If only one live track exists, skip the track step. That prompt is not a write. One-shot commands stay in the same scrollback (CLI picker). Only `session` (and TTY `trees` / no-args, which enter it) takes the alternate screen.
If omitted and the program cannot ask: error, print the compact title list (both tracks), exit non-zero.
If the prefix matches more than one title: pick among the matches, or error the same way when not interactive.

Piped `trees` lists every tree, grouped by track then kind. It does not pick.

Still one tree per sitting. No mixed queue across trees.

## Feel (TTY)

Useful first. Decoration second.

- **Banner:** the existing Retention wordmark, **only** on `help`. Never on `session` / `trees` / `queue` / `show` / `grade` / `inbox` / `capture` / `gap` / `gaps` / `mastery` / `graph` / `scheduler`. Version is on `help` and every TUI screen (`retention version` is the one-shot).
- **Color:** when stdout is a terminal. None when piped. Honor `NO_COLOR`. Knowledge titles cyan, term decks magenta, impure / “this will write” yellow, due queue green, empty queue dim, breadcrumbs dim. Do not rainbow every line.
- **Completions:** generate shell completions for commands, ratings, and tree **titles** (`retention completions zsh` or equivalent). Typing `retention queue <tab>` offers titles, not folder names. Completions stdout is the script only — no context line — so it can be sourced.
- **Two surfaces.** TTY `session` (also TTY no-args) is the TUI: options home, then Session or Trees. Session and Trees pick a **track** then a tree when more than one live track exists. TTY `trees` opens that path. Title argument on `session` opens that tree's queue and skips track. One-shot commands (`help`, `version`, `status`, `queue`, `show`, `mastery`, `graph`, `scheduler`, `grade`, `inbox`, `capture`, `gap`, `gaps`, `completions`, and every piped invocation) stay a CLI: print, maybe a line picker, return. Queue numbers on `queue` / `show` / `grade` / `gap` are still queue indices. Typing the argument still works and is the non-interactive path.

## Client language (open)

The engine stays TypeScript / Effect. The **client** may stay a Bun-compiled TypeScript binary, or move to Rust, if the TypeScript ecosystem cannot deliver this feel without fighting the compiler (completions, color, TUI, one artifact). A TUI that cannot restore the terminal after `q` has not delivered the feel.

That is **not decided**. Decide after a first pass at the feel in the current client, not before. A Rust client would still speak the same commands and consent rules; it would not reimplement mastery / graph / scheduler.

## Binary

TypeScript's compiler emits JavaScript, not a native binary.

This repo runs on Bun. This version ships a **standalone executable** via Bun compile (runtime + the program in one file). The user runs the named command. How the binary was produced is not part of the daily interface.

Until that artifact exists, `bun src/cli/main.ts` may be the developer stand-in — same arguments, same help, same consent. It is not the product.

## Does not (parked)

Interactive one-card review loop, curation, `--yes`, environment-variable config, opening or requiring the user to edit log or corpus files, showing folder names or card ids as the way to talk, holding a tree choice across process invocations.
