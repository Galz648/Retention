# This-version remaining inventory

Primary sources only: `specs/` and `src/` at `198d66a` (HEAD when this branch was cut). Not a build plan. Leftover v0s1/s2/s3 tickets are not current work.

**Gist:** Engine, Session, append-only log, corpus trees, and one-shot CLI with consent are shipped. Remaining for this version is the Session TUI, isolated `mastery`/`graph`/`scheduler` commands, nested `trees` listing, and compiled-binary TTY feel. Parked: Forester, calibrator, capture, curation, `--yes`, one-card review loop, env-var config. Still open: TypeScript vs Rust client, session-level events, Brightness name, gap-signal home.

## Spec drift (read this first)

Three locks describe “this version.” They do not agree on the surface.

| Lock | What it says the product is |
|---|---|
| `specs/mechanics/SCOPE.md` + `specs/mechanics/components/SESSION_CLI.md` + `specs/mechanics/GETTING_STARTED.md` | One-shot CLI: `help` / `status` / `trees` / `tree` / `show` / `queue` / `grade`. No-args = help, then a command select. `tree` is the node/edge dump. |
| `specs/mechanics/KEY_DECISIONS.md` + `specs/mechanics/GAPS.md` + `specs/mechanics/ARCHITECTURE.md` | TTY default is the Session TUI (home: Session / Trees / Status). Piped commands stay one-shot. Isolated pure `mastery` / `graph` / `scheduler`. **No `tree` dump** — you-are-here is the TUI path (`●`). Nested `trees` map. |

`src/cli/` implements the older SESSION_CLI command set (plus `completions`). It does not implement the GAPS/KEY_DECISIONS TUI or isolated engine commands.

Sibling files `MASTERY_CLI.md`, `GRAPH_CLI.md`, `SCHEDULER_CLI.md` **do not exist**. Isolated engine commands are specified only in `GAPS.md` and `KEY_DECISIONS.md`. `SESSION_CLI.md` does not list them.

`GETTING_STARTED.md` is stale: it still says compile is unwired and documents `tree` as the product dump. `package.json` already has `"compile": "bun build --compile --outfile retention src/cli/main.ts"`.

`OPEN-QUESTIONS.md` still tags interval algorithm, outcome vocabulary, and store location as `[blocker]`. Those are already answered in `src/` (FSRS inside mastery, `Again|Hard|Good|Easy`, hardcoded `corpus/` + `data/log.jsonl`). Do not treat that file’s blocker list as remaining this-version work.

---

## 1. Shipped

What `src/` does, and the specs that already describe it.

### Engine (mastery, graph, scheduler)

- Isolated Tags and Lives: `src/engine/mastery/`, `src/engine/graph/`, `src/engine/scheduler/`.
- Isolation is tested: `src/engine/no-cross-imports.test.ts` (engines never import each other; engine never imports store / corpus I/O / session / cli).
- Mastery: FSRS internally, discards due dates, emits Brightness 0–1 (`src/engine/mastery/live.ts`, `src/engine/mastery/interface.ts`). Matches `specs/mechanics/components/MASTERY.md`.
- Graph: eligible nodes = every prerequisite ≥ `THRESHOLD` (`src/engine/graph/live.ts`). Matches `GRAPH.md`.
- Scheduler: due = Brightness < `THRESHOLD` (`src/engine/scheduler/live.ts`, imports `THRESHOLD` from `src/config.ts`). Matches `SCHEDULER.md`.
- Property-style tests already use `effect/FastCheck` in the three engine `live.test.ts` files.

### Session

- Impure compose: `src/session/interface.ts`, `src/session/live.ts`, `src/session/runtime.ts`.
- `queue` intersects scheduler due-ids with graph-eligible nodes; recall then derivation (`src/session/live.ts`).
- `grade` appends exactly one `card.reviewed` (`src/session/live.ts`, `src/domain/events.ts`).
- Consent is not in Session (`SESSION.md`; `src/session/interface.ts` comment). Clock is supplied by the CLI (`src/cli/main.ts`).

### Store and corpus

- Append-only JSONL log: `src/store/jsonl.ts`, `src/store/interface.ts`. V1 event union is `card.reviewed` only (`src/domain/events.ts`).
- Corpus I/O: `src/corpus/layers.ts`. Lists by human `title` / `kind` / `summary` from `meta.json`. Archive moves trees; does not delete.
- Hand-authored trees live under `corpus/` (18 `meta.json` files). Titles match the GAPS rename table (no `seed tree`, no `Term Drill State` in `corpus/`).

### One-shot CLI (SESSION_CLI command set)

Implemented in `src/cli/handle.ts`, entered from `src/cli/main.ts`. Covered by `src/cli/handle.test.ts`.

| Command | Code | Spec |
|---|---|---|
| `help` | labeled `[pure]` / `[impure]` list + descriptions | `SESSION_CLI.md` Commands |
| `status` | log present/absent; tree title if named | `SESSION_CLI.md` `status` |
| `trees` | kind groups, title + one-liner, no counts, no folder names | `SESSION_CLI.md` `trees` (flat groups, not GAPS nested map) |
| `tree` | nodes, card counts, `from → to` titles | `SESSION_CLI.md` `tree`; `GETTING_STARTED.md` — **conflicts with KEY_DECISIONS** |
| `queue` | numbered, type, node title, prompt; `queue empty` | `SESSION_CLI.md` `queue` |
| `show` | type, node title, prompt, answer / must-hits | `SESSION_CLI.md` `show` |
| `grade` | consent line, create-log warning, `Proceed? [y/N]`; piped refuses | `SESSION_CLI.md` `grade`; `KEY_DECISIONS.md` consent |
| `completions` | zsh/bash script; titles not folder names; no context line | `SESSION_CLI.md` Feel; `GAPS.md` exception |

Also shipped:

- Title match / unique prefix: `src/cli/titles.ts`.
- Banner on help only when `banner` is on; never on queue (`handle.test.ts`).
- Color gated on stdout TTY and `NO_COLOR` (`src/cli/style.ts`, `src/cli/main.ts`). Impure lines yellow.
- CLI sources must not import engine modules (`handle.test.ts` “CLI sources do not import engine components”).
- Package name `retention`; compile script present (`package.json`).
- Developer stand-in: `"review": "bun src/cli/main.ts"` (`package.json`); matches `GETTING_STARTED.md`.

### Cards and ratings

- Card kinds in code: `recall` | `derivation` only (`src/domain/cards.ts`). Practice is a parked TODO comment, not a type.
- Outcomes: `Again` / `Hard` / `Good` / `Easy` (`src/domain/cards.ts`).

---

## 2. Remaining for this version

What locked this-version specs still demand and `src/` does not do. Not parked features. Not OPEN-QUESTIONS fog.

### Session TUI (KEY_DECISIONS + GAPS)

`KEY_DECISIONS.md` and `GAPS.md` lock TTY default as the Session TUI: no args or `retention session` opens an options menu (Session, Trees, Status) with the build version; `q` restores the previous terminal. TTY `trees` enters the TUI on the map. Alternate screen, j/k or arrows, enter, `b` back.

**Code:** no `src/cli/session.ts`, no TUI module. `src/cli/` is handle + one-shots. `main.ts` maps missing args to `handle` → `help`. `io.select` is stubbed to always `undefined` (`src/cli/main.ts`). `src/cli/select.ts` exists (raw-mode list) but `handle.ts` never calls `io.select`.

`SESSION_CLI.md` still specifies the older no-args path (help, then command select). That file has not been rewritten to match KEY_DECISIONS.

GAPS names landmines that are still in code / unproven:

- `proc?.stdin?.unref?.()` in `src/cli/main.ts` (hang workaround).
- Compiled `./retention` reporting `stdout.isTTY` false (documented in GAPS; no compiled binary is in the tree to re-verify here).

### Isolated engine commands (GAPS + KEY_DECISIONS)

`mastery`, `graph`, and `scheduler` must each be a pure one-shot that talks to one engine Tag. CLI module may load corpus or log; must not import the other two engines. Session CLI must not compute Brightness.

**Code:** no such commands in `handle.ts` or `completions.ts`. No `src/cli/mastery.ts` / `graph.ts` / `scheduler.ts`. No sibling CLI specs.

`OBSERVABILITY.md` already writes as if `mastery` prints one Brightness number. That command is not in `src/`.

### Nested `trees` listing (GAPS + KEY_DECISIONS)

GAPS: knowledge trees with term decks hanging underneath (`├─` / `└─`); `belongsTo` on disk is the parent folder name; unattached decks in their own group. Term decks stay separate trees and queues.

**Code:** `src/cli/trees-view.ts` prints two flat groups (Knowledge trees / Term decks). `TreeListing` and corpus `Meta` have no `belongsTo` (`src/domain/corpus.ts`, `src/corpus/layers.ts`). Tests lock the flat grouping (`src/cli/trees-view.test.ts`).

### Feel that SESSION_CLI / GAPS still demand

- **Arrow-key select** for omitted command / title / queue index / rating on a TTY (`SESSION_CLI.md` Feel). Code uses `io.ask` / Bun `prompt()` numbered questions (`handle.ts` `pickInteractive`, `show`, `grade`). KEY_DECISIONS: “Numbered `prompt()` is not the TTY product.”
- **Color roles** in GAPS: knowledge cyan, terms magenta, warn yellow, due green, empty dim. `src/cli/style.ts` has cyan heading, yellow warn, dim, bold — no magenta, no due-green, and `trees-view.ts` is uncolored.
- **Unknown command:** GAPS acceptance says print help once, exit non-zero, do not print help on both stdout and stderr. `handle.ts` writes help then `fail(helpText)`; `main.ts` prints `error.reason` on stderr — help can appear twice.
- **Standalone binary as the product** (`SCOPE.md` milestone 3, `SESSION_CLI.md` Binary, `GETTING_STARTED.md` “once the binary exists”). Compile script exists; no `retention` artifact in the tree; GAPS still treats compiled TTY detection as unshipped.

### `tree` dump vs TUI path

- SESSION_CLI + GETTING_STARTED + current tests: `tree` is in this version and shipped.
- KEY_DECISIONS: “There is no `tree` dump command.”

That is remaining **spec consistency**, not new engine work. Until KEY_DECISIONS and SESSION_CLI agree, do not treat deleting or keeping `tree` as decided by code.

---

## 3. Parked

Explicitly out of this version. Specs say do not build. Code does not implement them (except the `tree` conflict in §4).

From `SCOPE.md` “This version — do not build” and `SESSION_CLI.md` “Does not (parked)” / `GAPS.md` “Still parked”:

| Item | Where parked | Code |
|---|---|---|
| Forester | `SCOPE.md`; `FORESTER.md` “not built”; `DECISIONS.md` 2026-09-11 | no `src/forester/` |
| Capture | SCOPE, SESSION_CLI, GAPS | no events; `src/domain/events.ts` says do not add |
| Curation | SCOPE, SESSION_CLI, GAPS | same |
| Calibrator | SCOPE; `KEY_DECISIONS.md` “not built” | `THRESHOLD` and FSRS `w` scales are placeholders (`src/config.ts`, `src/engine/mastery/live.ts`) |
| Dormancy / retirement | SCOPE; `events.ts` parked list | no event type |
| `--yes` / non-interactive writes | SCOPE, SESSION_CLI, TRADEOFFS | grade refuses when not interactive |
| Env-var configuration as the interface | SCOPE, KEY_DECISIONS, TRADEOFFS | paths hardcoded in `main.ts`; only `NO_COLOR` is read (allowed by GAPS/SESSION_CLI) |
| Interactive one-card review loop | GAPS, SESSION_CLI | not present |
| Any UI except this CLI | SCOPE | no other client in `src/` |
| `browse` | KEY_DECISIONS “gone” | not in `handle.ts` |
| Status verbose paths | SESSION_CLI `status` | not printed |
| Practice / exercise / challenge card kinds | `cards.ts` TODO; `LEGEND.md`; OPEN-QUESTIONS deferred | union is recall + derivation only |
| Model grader | `LEGEND.md` | log stores a plain grade |
| CLI `--trace` / tag-level engine tracing | `OBSERVABILITY.md` | not present |
| Structured machine-readable trace | `OBSERVABILITY.md` | not present |
| Must-hit accretion, tree-archive events | `src/domain/events.ts` | V1 is `card.reviewed` only |

Gap signal (`GAP_SIGNAL.md`) is **not built** and is **not** in SCOPE’s this-version build list. Home (event field vs new event vs `signals/`) is still open — see §4. Do not treat it as remaining CLI work.

---

## 4. Still a product decision

Named as open in the this-version locks. Not remaining implementation. Not leftover tickets.

| Decision | Source | Notes |
|---|---|---|
| TypeScript/Bun client vs Rust client | `KEY_DECISIONS.md`, `GAPS.md` “Open”, `SESSION_CLI.md` “Client language”, `TRADEOFFS.md` | Engine stays TypeScript. Decide after the current client is tried against completions + TUI + color + one binary. |
| Session-level events for the calibrator | `GAPS.md` “Open: session-level events” | Reconstruct from `card.reviewed` timestamps vs explicit `session.*`. Engine + store change; a client must not invent log shapes. Until then, sitting size is decided in the moment and a plain summary is printed. |
| Brightness name | `ARCHITECTURE.md`; `src/domain/brightness.ts` “PLACEHOLDER NAME” | Candidates in comments: strength, readiness — not “retention”. |
| Threshold / FSRS internal scales | `KEY_DECISIONS.md`; `src/config.ts`; mastery `TODO: tune these FSRS w sets` | Placeholders until evidence. Calibrator is parked; reaching for a new tuning constant is the signal the value belongs in the log. |
| `tree` dump vs TUI-only path | SESSION_CLI + GETTING_STARTED vs KEY_DECISIONS | Specs disagree. Code has `tree`. |
| Gap-signal persistence home | `GAP_SIGNAL.md` “Where it lives” | Field on `card.reviewed` vs `gap.observed` vs `signals/`. Store + engine decision. |
| Receipt / `--explain` on the CLI | `OBSERVABILITY.md` Open refinements | Skill-side `receipt` default-on is decided (`DECISIONS.md` 2026-09-11). Whether the CLI also has `retention session --explain` is not. |
| Node Brightness fold | `src/session/live.ts` TODO | Min of a node’s cards is a placeholder, not a claim about how a concept is known. |

`OPEN-QUESTIONS.md` has many more items (leeches, spoken derivation, multi-course allocation, top-down traversal, …). Those are not this-version remaining work. This map’s destination (`specs/mechanics/INVARIANTS.md`) is a hand-off spec, not that fog.

---

## Specs demand / code does not

Compact list for the hand-off spec.

1. Session TUI on TTY (`KEY_DECISIONS.md`, `GAPS.md`). No `session` command, no alternate screen.
2. Isolated pure `mastery` / `graph` / `scheduler` commands (`GAPS.md`, `KEY_DECISIONS.md`). No modules, no help lines.
3. Nested `trees` with `belongsTo` (`GAPS.md`). Listing is flat kind groups.
4. TTY `trees` enters the TUI (`KEY_DECISIONS.md`). Code always prints and returns.
5. Arrow-key select as the TTY chooser (`SESSION_CLI.md` Feel). `select.ts` unused; `main.ts` stubs `select`.
6. GAPS color roles (magenta terms, green due). Palette is heading/warn/dim/bold only.
7. Compiled binary that detects a real TTY (`SCOPE.md` milestone 3, GAPS landmines). Script exists; artifact + TTY feel not shown in-tree.
8. Unknown command: help once (`GAPS.md`). Code can print help on stdout and stderr.
9. SESSION_CLI.md / GETTING_STARTED.md updated to the KEY_DECISIONS surface (TUI, isolated engines, no-or-keep `tree`). Spec remaining, not code.

## Code does / specs parked or superseded

1. **`tree` dump** — implemented and tested (`handle.ts`, `handle.test.ts`). KEY_DECISIONS says there is no dump. SESSION_CLI and GETTING_STARTED still require it.
2. **Numbered `prompt()` as the TTY picker** — `handle.ts` + Bun `prompt` in `main.ts`. KEY_DECISIONS / GAPS: numbered `prompt()` is not the TTY product.
3. **`stdin.unref()`** — `src/cli/main.ts`. GAPS: hang workaround; do not keep if it breaks the TUI.

Nothing in `src/` implements Forester, capture, curation, `--yes`, env-var tree selection, a review loop, or extra event types. Those parked items are absent, not sneaking through.

---

## Tests that pin the current surface

- `src/cli/handle.test.ts` — labeled help, banner-not-on-queue, trees without counts/ids, queue/show/grade consent, `tree` dump, completions titles, no engine imports from CLI.
- `src/cli/trees-view.test.ts` — flat Knowledge / Term groups.
- `src/cli/style.test.ts` — NO_COLOR / non-TTY disable ANSI.
- `src/session/live.test.ts` — queue compose + grade append.
- `src/engine/*/*.test.ts` + `no-cross-imports.test.ts` — engine isolation and due/eligible/Brightness.
- `src/store/jsonl.test.ts`, `src/corpus/layers.test.ts`, `src/codec/layers.test.ts` — I/O.

No test file covers a TUI, `mastery`/`graph`/`scheduler` CLI, or nested `belongsTo` listing — those commands/modules are not in `src/`.
