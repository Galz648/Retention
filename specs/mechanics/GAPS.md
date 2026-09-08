Resolved: TypeScript does not generate a binary; this version uses Bun compile. Environment-variable UX is rejected. User-facing language is titles + glossary, not folder names or card ids. The program is named **`retention`**. Feel (color, banner, completions, select) is specified; the client language (TypeScript vs Rust) is **not** decided.

## Experience this version must feel like

You only talk to `retention`. You never set hidden settings, and you never open data files to see a tree or a card.

**You can see every tree — and tell them apart.** `retention trees` groups **knowledge trees** (concepts and dependencies) vs **term decks** (names to recall). Each row is a human title and one sentence. Not a dump of node/card/edge counts. Not importer labels (`seed tree`, `Term Drill State — …`).

**Each time you run a command, you choose the tree.** Title argument, unique prefix, or a select. Nothing stuck from a previous run.

**Nothing is written unless you say yes.** `grade` states what it will append, then `Proceed? [y/N]`. Default no. Piped input refuses. Pure commands never create files.

**Each command says what it is.** Help lists a one-line description. Running a command repeats that line in context, then the payload.

**TTY may be cool; pipes stay boring.** Banner on help only. Color on terminals, none when piped (`NO_COLOR` too). Completions for commands and titles. Arrow-key select when arguments are omitted.

Still parked: interactive one-card review loop, capture, curation, `--yes`.

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

## Open: TypeScript client vs Rust client

Not a product question about commands. A later implementation question:

Stay on Bun if completions, color, and select can ship without pain.
Move the **client only** to Rust if they cannot. Engine (mastery, graph, scheduler, session) stays TypeScript.

## Next `/goal` (feel pass) — paste when ready

```
Make the retention client match the feel and trees listing in specs/mechanics/components/SESSION_CLI.md and specs/mechanics/GAPS.md.

trees: group knowledge trees vs term decks; human titles; one-sentence descriptions; no counts on the list. Rename importer titles as in GAPS (data + listing).
help: description per command; banner on TTY help only.
Each command: one context line, then payload.
TTY: color (honor NO_COLOR; none when piped), arrow-key select when args omitted, shell completions for commands and titles.
Do not rewrite the client in Rust this pass. Do not add capture, curation, or an interactive review loop.
Keep consent: grade still asks; piped input still refuses; queue still must not create the log.

Evidence: tests for grouped listing and title copy; a TTY-off run with no ANSI; help contains descriptions; real run of retention trees / help / queue.
```
