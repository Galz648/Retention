Resolved: TypeScript does not generate a binary; this version uses Bun compile. Environment-variable UX is rejected. User-facing language is titles + glossary, not folder names or card ids. The program is named **`retention`**. Feel (color, banner, completions, TUI session vs CLI one-shots) is specified; the client language (TypeScript vs Rust) is **not** decided. `browse` is gone. TTY default is the session TUI (alternate screen). Isolated `mastery` / `graph` / `scheduler` commands talk to one engine Tag each.

## Experience this version must feel like

You only talk to `retention`. You never set hidden settings, and you never open data files to see a tree or a card.

**You stay in the process.** TTY with no args, or `retention session`, is the Session TUI — named for the Session component. Home is the options menu (Session, Trees, Status) with the build version. **Session** is due cards, inspect, grade with consent. **Trees** is the map with a you-are-here path (`●`). Alternate screen, highlight, enter, `b` back, `q` quit (restores the previous terminal). The process does not return to the shell until you quit. Next invocation starts clean; nothing remembers the tree.

**You can see every tree — and tell them apart.** Piped `retention trees` prints a nested map: **knowledge trees** with any term decks that belong to them hanging underneath (`├─` / `└─`), titles in one column, the one-line what-it-is in a second. Unattached decks (German, and any deck with no parent) have their own group. Not a dump of node/card/edge counts. Not importer labels (`seed tree`, `Term Drill State — …`). Term decks stay their own trees and queues; nesting is listing only. TTY `trees` enters the TUI on Trees (the map).

**Piped commands stay one-shot.** `queue`, `show`, `mastery`, `graph`, `scheduler`, piped `trees` / `session`: print and return.

**Each one-shot chooses the tree.** Title argument, unique prefix, or a prompt. Nothing stuck from a previous run.

**Nothing is written unless you say yes.** `grade` states what it will append, then `Proceed? [y/N]`. Default no. Piped input refuses. Pure commands never create files.

**One engine at a time.** `mastery`, `graph`, and `scheduler` are isolated and **pure**. Each talks to one engine Tag. The CLI module may load corpus or log; it must not import the other two engines. Session CLI does not compute Brightness itself.

**Each command says what it is.** Help lists a one-line description, each marked `[pure]` or `[impure]`. Running a command repeats that line in context, then the payload. `completions` is the exception: stdout is the script only.

**TTY may be cool; pipes stay boring.** Banner on help only. Color on terminals, none when piped (`NO_COLOR` too): knowledge cyan, terms magenta, warn yellow, due green, empty dim. Completions for commands and titles. TTY `session` is a fullscreen TUI (alternate screen, keys). One-shot commands stay CLI. Numbered `prompt()` is not the TTY product.

Still parked: interactive one-card review loop, curation, `--yes`.

## Why `trees` felt the same

Two different things were imported with similar, ugly titles:

| What it actually is | Example human title | What you saw |
|---|---|---|
| Knowledge tree | Biology II | Biology II — seed tree |
| Term deck | Biology II ecology terms | Term Drill State — biology-ii-ecology |

Counts (42 nodes, 99 cards) do not say that. Kind + a sentence does.

## Titles to use (data cleanup, with the feel pass)

Knowledge trees: drop “seed tree” / “tree” suffixes. `Component A — Estimation method` → **Cell biology by the numbers**. `derivatives-integrals-drill` → **Derivatives and integrals drill**.

Term decks: **{subject} terms** (ecology, animal systems, Cooper cell biology, German frequency, …) — never `Term Drill State`.

A term deck may **belong to** a knowledge tree in the listing (`belongsTo` on disk is the parent folder name). Biology II ecology terms hang under Biology II. German has no parent. Do not merge the graphs or the queues.

## Open: TypeScript client vs Rust client

Not a product question about commands. A later implementation question:

Stay on Bun if completions, color, and the TUI can ship without pain (including restore after `q`).
Move the **client only** to Rust if they cannot. Engine (mastery, graph, scheduler, session) stays TypeScript.

## Open: session-level events for the calibrator

The log records one `card.reviewed` per grade. It does not record the shape of a **sitting**: how many cards, the recall / derivation mix, elapsed time, whether the person finished the due queue or stopped partway. A calibrator that tunes session size and per-card-type pacing (KEY_DECISIONS — *adaptive parameters are learned, not configured*) needs that shape.

Not decided: whether a sitting is reconstructed after the fact from `card.reviewed` timestamps (a long gap = a session boundary), or written explicitly as a `session.*` event. Explicit is more honest about intent — a paused-and-resumed sitting, a session abandoned mid-card — but adds an event type and a writer. Either way this is an engine + store change: a review client must not invent its own event shapes in the shared log.

Until it exists, a review client decides session size with the user in the moment and prints a plain session summary (card count, type mix, rating spread) for the user's own reference. That summary is the data we will eventually want captured structurally.

## Next `/goal` (session TUI) — paste when ready

```
Ship the Session TUI specified in specs/mechanics/components/SESSION_CLI.md (Feel + `session`). Specs already lock the product. Do not reopen parked features.

Product
- TTY `retention` / `retention session` / TTY `trees`: fullscreen TUI on the alternate screen. Highlight a row; redraw in place. Keys: j/k or arrows, enter, b back, q quit. q (and crash/interrupt) must leave the alternate screen and restore the previous terminal; process then exits 0 to the shell. Breadcrumb names the current tree/node. Optional [title] enters that tree.
- Navigation: root (knowledge trees + unattached decks; attached decks shown under their parent, not as separate root rows) → tree (graph roots, then attached decks) → node (cards, then children) → card inspect (same payload as `show`, not a review). Term deck: same node walk as a tree.
- n/curses extras (boxes, status bar, mouse, type-to-filter) are optional chrome. Numbered `prompt()` / `m` more is not the TTY product.
- One-shot commands stay CLI (print, maybe a line picker, return). Never enter the alternate screen. Piped `session`/`trees`: nested aligned list, no color, no banner, no alternate screen, return. Queue numbers on `queue`/`show`/`grade` stay queue indices.
- Color on a real TTY (knowledge cyan, terms magenta, warn yellow, due green, empty dim, breadcrumb dim). Honor NO_COLOR. Banner on TTY help only. Completions stdout is the script only.
- Isolated pure `mastery`/`graph`/`scheduler` unchanged: one engine Tag each, titles not folder names, no writes, no composing the other two. Session CLI does not compute Brightness.
- Consent unchanged: grade still asks; piped impure refuses; missing log is empty history, no file created. Do not add capture, curation, one-card review loop, --yes, env-var config. Do not edit the Obsidian vault. Do not edit engine, store, or Session.queue/grade unless a CLI compile error forces a type-only touch — then stop and say so.

Known landmines
- Bun raw-mode previously hung (never returned to the shell). A TUI that cannot restore after q has not shipped. `stdin.unref()` was a hang workaround; do not keep it if it breaks the TUI.
- Compiled `./retention` currently reports stdout.isTTY false even when stdin is a TTY, so color/banner never fire. TUI + color must detect a real terminal on the compiled binary, not only `bun src/cli/main.ts`.
- Toolkit is not chosen. First pass in this TypeScript/Bun client. If the runtime cannot own the terminal and restore after q, that is evidence to move the client (still not a decision in this goal). Do not start a Rust client in this goal.

Parallelization — read agent/parallel.md beside this project's Cursor agent transcripts (not in the repo). If missing, follow this:

Three moves, do not mix:
1. Same-turn tool calls for independent reads/greps/tests/non-overlapping edits.
2. Same-turn Task subagents with disjoint write-sets. Each subagent: write-set, paths it must not touch, acceptance, short return. Main thread integrates. Shared files stay on the main thread: `src/cli/handle.ts`, `src/cli/completions.ts`, `src/cli/main.ts`, `src/session/runtime.ts`.
3. Git worktrees only if two branches must exist on disk at once. This goal is one branch (`v0/unconstrained-build`). Do not create worktrees for it.

Suggested streams (only if write-sets stay disjoint):
- TUI primitive: new files only under `src/cli/` (alternate screen enter/leave including on throw, key decode, highlighted list). Must not import mastery/graph/scheduler. Must not touch handle.ts / main.ts.
- Session navigation + tests: `src/cli/session.ts`, `src/cli/session.test.ts` — after the primitive exists, or keep this on the main thread if it must land in the same turn as the primitive.
- Do not parallel-edit engine, store, corpus I/O, or Session.queue/grade.
If a stream needs another stream's uncommitted files, it is not parallel-safe — main thread.

Do not commit unless I ask. Do not push.

Acceptance (all required)
- bun test passes. Isolation still holds: session-facing CLI must not import the other engines; mastery/graph/scheduler CLI modules still import only their own.
- Piped: `retention trees|session|help|queue "Biology II"|mastery|graph|scheduler` — no ANSI, no alternate screen, no `data/` created. Unknown command: help once, exit non-zero (do not print help on both stdout and stderr).
- TTY (PTY or `script`): `./retention` after `bun run compile` enters alternate screen; j/k or arrows move; enter opens; b back; q restores the previous terminal and exits 0. Color on that TTY unless NO_COLOR. Piped compile run still plain.
- Real run of compiled `./retention help` (TTY: banner), `trees` (TTY: TUI), piped `trees`, `mastery`, `graph`, `scheduler`. Do not run `grade` except existing tests.
- Do not expand into review-loop / capture / Rust client.

After acceptance passes — stale worktrees
This goal must not leave new worktrees. Then clear leftovers from the old engine split. Primary checkout is `/Users/galzafar/Documents/GitHub/Retention` on `v0/unconstrained-build` — never remove it.

Known stale worktrees (remove only if `git -C <path> status --porcelain` is empty; if dirty, list the path and stop that one):
- `/Users/galzafar/Documents/GitHub/Retention-corpus` (`v0/corpus`)
- `/Users/galzafar/Documents/GitHub/Retention-graph` (`v0/engine-graph`)
- `/Users/galzafar/Documents/GitHub/Retention-mastery` (`v0/engine-mastery`)
- `/Users/galzafar/Documents/GitHub/Retention-scheduler` (`v0/engine-scheduler`)
- `/Users/galzafar/Documents/GitHub/Retention-store` (`v0/store`)
- `/Users/galzafar/Documents/GitHub/Retention-v0s2` (`v0s2`)

For each eligible: `git worktree remove <path>`. Then `git worktree prune`. `git worktree list` must show only the primary checkout. Do not delete the branches themselves unless a worktree remove requires it and the branch has no unique uncommitted work — prefer remove the worktree, leave the branch. Report what you removed and what you skipped (dirty).
```
