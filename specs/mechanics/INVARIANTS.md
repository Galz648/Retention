# Invariants

Standing law for this version. Agents, plans, and **new modules** must uphold these claims in how they are built, not only in later behavior.

`KEY_DECISIONS.md` stays the product lock. This file is the **executable** subset: each id is one claim, cited from a test. Do not invent product policy here. Copy a claim from a locked spec, or do not add it.

Draft for [Catalog format, property mapping, husky contract](https://github.com/Galz648/Retention/issues/38) and [New-module construction rules](https://github.com/Galz648/Retention/issues/39). Husky is specified, not installed.

## Lifecycle

Solo developer. No CI.

When hooks are later installed (not this ticket):

```
bun add --dev husky
bunx husky init
```

`.husky/pre-commit`:

```
bun run typecheck
bun test
```

That is `tsc --noEmit` then the existing `bun:test` suite, including `effect/FastCheck` properties. Skip hatches: `git commit -n`, `HUSKY=0`.

**Not on pre-commit:** `bun run compile`, PTY / `script` TTY walks, compiled `./retention`. Those stay the manual checklist in `GAPS.md`.

**Typecheck covers tests.** `tsconfig.json` currently excludes `src/**/*.test.ts`, so today's `bun run typecheck` does not see properties. That is a hole. When hooks land, drop that exclude and add whatever bun test types `tsc` needs so `import { test } from "bun:test"` typechecks. Properties are standing law; they must typecheck on the same hook that runs them. If a property outgrows bun:test's 5s default, raise that test's timeout. Do not drop `numRuns` to fit the hook.

Until husky exists, `bun test` and `bun run typecheck` are still how a session proves it did not break the catalog. The hook is that same pair, automatic.

`GETTING_STARTED.md` should point here in one line when the hook is installed ("pre-commit runs typecheck + tests, including invariant properties — see INVARIANTS.md"). Do not duplicate the catalog there.

## How a check cites an id

Generation means **generators of inputs**, not compiling this file into tests.

| Kind of claim | How it is encoded | Tool |
| --- | --- | --- |
| Quantified over domain values at an engine (or Session) seam | `fc.assert(fc.property \| fc.asyncProperty)` inside `test()` | `import * as fc from "effect/FastCheck"` |
| Named spec edge, CLI/TUI screen, flag, consent line | bun:test example | `bun:test` only |
| Construction (imports, no Clock, no `--yes`) | source scan of `src/` | bun:test reading files |

**Citation:** put the catalog id in the `test()` string, then a short claim. `bun test -t INV-B-SCH-01` must select it. A comment is optional, not the citation. No wrapper helper. No markdown-to-test compiler.

```ts
test("INV-B-SCH-01: due iff strictly below threshold", async () => {
  await fc.assert(fc.asyncProperty(classifiedArb, async (input) => { /* ... */ }))
})
```

Keep `effect/FastCheck` as the only PBT API. Do not add a second generator library. Add `fast-check` as a *direct* dependency only when Effect stops re-exporting it (v4 RC already says this) or when we need a fast-check major Effect has not taken — same package, new import path, not a methodology change.

**Where generators belong:** mastery / graph / scheduler Live (already), later Session.queue/grade if the claim is still about cards / events / corpora. Call the Tag, not the CLI.

**Where examples belong:** Session CLI, TUI keys, ANSI, help labels, PTY, source scans. `test.each` over a command table is enough for "every impure command refuses when not interactive." Promote to FastCheck only if the input space is large and shrinking would help.

A new module ships checks for the ids that apply at **its** seam (`INV-C-MOD-01`). See **New module** below.

## Id scheme

```
INV-{kind}-{owner}-{nn}
```

| Piece | Values |
| --- | --- |
| `kind` | `B` behavior (true of any run) · `C` construction (true of how a module is built) |
| `owner` | `LANG` language · `CLI` Session CLI · `SES` Session · `ENG` Engine isolation · `MST` Mastery · `GRF` Graph · `SCH` Scheduler · `STO` Store · `MOD` any new module |
| `nn` | `01`… stable within owner + kind. Do not reuse. |

One claim per id. The property cites the id; the id does not cite the property. Owner is the seam that must uphold the claim. Do not put placeholder knobs in the id (`BRIGHTNESS`, `W`, `0.9`). Parked product does not get an id.

Encoding: **property** (FastCheck) · **example** (bun example / source scan) · **prose** (locked, no test yet).

Product specs still say **component** (Engine, Session, Session CLI). Construction talk uses **module**, interface, seam, adapter.

---

## Behavior

### Language

| Id | Claim | Encoding |
| --- | --- | --- |
| **INV-B-LANG-01** | The person sees titles, prompts, and glossary words. They do not see folder names, card ids, or file formats. | example — `src/cli/handle.test.ts`, `trees-view.test.ts`, `titles.test.ts` |

### Session CLI

| Id | Claim | Encoding |
| --- | --- | --- |
| **INV-B-CLI-01** | The command-line program is the only client. The user does not set environment variables to choose a tree or open corpus/log files to use the system. Paths are owned by the program. `NO_COLOR` is feel, not tree/log selection. | prose |
| **INV-B-CLI-02** | Commands are labeled **pure** (no create/append/move/delete) or **impure** (any write). Help marks each `[pure]` / `[impure]` with a one-line description. Impure entries note that they ask first. | example — `src/cli/handle.test.ts` |
| **INV-B-CLI-03** | Impure commands state what will happen, then ask. Default is no. Only `y` / `yes` (case-insensitive) continue. Grade consent names the prompt, the rating, that this appends one review, and that a missing log **will create it**. | example — `src/cli/handle.test.ts` |
| **INV-B-CLI-04** | If the program cannot ask yes/no, an impure command **refuses** rather than writing. | example — `src/cli/handle.test.ts` |
| **INV-B-CLI-05** | Missing log = empty history. Pure commands do not create the log or its directory. `queue` on a missing log must not create anything. | partial — store missing-file is example (`src/store/jsonl.test.ts`); no Session CLI test that `queue` leaves the filesystem untouched |
| **INV-B-CLI-06** | Each invocation chooses a tree (title, unique prefix, or picker). Tree choice is not held across process invocations. | prose (title matching is example in `titles.test.ts`) |
| **INV-B-CLI-07** | Numbers on `queue` / `show` / `grade` refer to the current queue for that tree, not to internal card ids. | example — `src/cli/handle.test.ts` |
| **INV-B-CLI-08** | `queue` prints type, node title, prompt — no answers, no card ids. `show` prints the answer (recall) or must-hits (derivation). | example — `src/cli/handle.test.ts` |
| **INV-B-CLI-09** | Piped / non-TTY output is plain text: no color, no banner. Banner only on `help`. Honor `NO_COLOR`. | example — `src/cli/handle.test.ts`, `style.test.ts` |
| **INV-B-CLI-10** | Unknown command: print help, exit non-zero. A listed command restates its description in context, then the payload. `completions` stdout is the script only. | partial — completions and context line are example; unknown-command exit is prose |
| **INV-B-CLI-11** | `trees` is a short list by kind: **title** + one sentence. Not counts, folder names, or importer leftovers as the title. | example — `src/cli/handle.test.ts`, `trees-view.test.ts` |

TTY Session TUI (options menu, `q` leaves, no `tree` dump, you-are-here is `●`) is standing product law in `KEY_DECISIONS.md`. Do not mint TUI keybinding ids until that surface is the locked feel in this catalog's encoding, not remaining `/goal` work.

### Session

| Id | Claim | Encoding |
| --- | --- | --- |
| **INV-B-SES-01** | Consent is in Session CLI, not in Session. `Session.grade` does not prompt. | prose |
| **INV-B-SES-02** | `queue` is read-only. Missing log = empty history, no file created. Session does not create nodes. | prose at this seam |
| **INV-B-SES-03** | `grade` appends exactly one `CardReviewed` and nothing else. Unknown card is not written. | example — `src/session/live.test.ts` |
| **INV-B-SES-04** | Session composes the engine: due ∩ eligible. It does not decide due-ness, compute mastery, or walk prerequisites itself. Queue presentation is recall then derivation. | partial — blocking is example; recall-before-derivation is specified, not FastCheck |

### Engine relations (not knobs)

The name of the `[0, 1]` number is a placeholder. The **relations** are locked. Numeric `THRESHOLD` is not an id.

| Id | Claim | Encoding |
| --- | --- | --- |
| **INV-B-MST-01** | Mastery emits one number per input card, in `[0, 1]`. Reviews for unknown card ids are ignored. | property — `src/engine/mastery/live.test.ts` |
| **INV-B-MST-02** | Same events, cards, and Clock → identical map. | property — same file |
| **INV-B-MST-03** | Between two times with no review for that card in `(t1, t2]`, the number does not increase. | property — same file |
| **INV-B-MST-04** | After the same history, recall fades faster than derivation. Rates / FSRS `w` are not this claim. | example — same file |
| **INV-B-GRF-01** | A node is never eligible while a **valid** prerequisite is below the threshold. Missing snapshot treats a prerequisite as 0. | property — `src/engine/graph/live.test.ts` |
| **INV-B-GRF-02** | An archived corpus yields no eligible nodes. | property |
| **INV-B-GRF-03** | Edges whose endpoints are missing from the node set are ignored. Isolated / no-valid-prereq nodes are eligible. | property + example |
| **INV-B-GRF-04** | Same corpus + snapshot → identical output. Eligible ids are sorted and drawn only from corpus nodes. | property |
| **INV-B-SCH-01** | Due iff the number is **strictly below** the threshold. At-threshold is not due. Scheduler does not know dependencies, card types, or the time. | property — `src/engine/scheduler/live.test.ts` |
| **INV-B-SCH-02** | Same map always yields the same ids, in sorted `CardId` order. | property |

### Store

| Id | Claim | Encoding |
| --- | --- | --- |
| **INV-B-STO-01** | The store appends and reads records. It does not interpret them. A missing file is empty history, not an error. | example — `src/store/jsonl.test.ts`, `memory.test.ts` |

---

## Construction

### Engine isolation

| Id | Claim | Encoding |
| --- | --- | --- |
| **INV-C-ENG-01** | Mastery, graph, and scheduler never import each other. | example — `src/engine/no-cross-imports.test.ts` |
| **INV-C-ENG-02** | Engine source does not import store, corpus I/O, session, or cli. | example — same file |
| **INV-C-MST-01** | Mastery Live never provides a Clock. It lists Clock in `R`. It does not call `Date.now` or `Clock.currentTimeMillis`. | example — `no-cross-imports.test.ts`, `mastery/live.test.ts` |
| **INV-C-GRF-01** | Graph Live does not import Clock. Graph does not know the time. | example — `src/engine/graph/live.test.ts` |
| **INV-C-SCH-01** | Scheduler Live is blind to card type, edges, and Clock. It imports `THRESHOLD` from `src/config.ts`; it does not embed a magic literal. | example — `src/engine/scheduler/live.test.ts` |

### Session and Session CLI

| Id | Claim | Encoding |
| --- | --- | --- |
| **INV-C-SES-01** | Session does not compute the `[0, 1]` number or the threshold compare. It does not construct a Clock — the caller supplies Clock and confirmation. | example — `src/session/live.test.ts` |
| **INV-C-CLI-01** | Session CLI does not compute the `[0, 1]` number, decide due-ness, walk prerequisites, or create nodes. CLI sources do not import engine Tags or `THRESHOLD`. | example — `src/cli/handle.test.ts` |
| **INV-C-CLI-02** | There is no `--yes` in this version. Non-interactive writes are refused, not overridden by a flag. | prose |
| **INV-C-CLI-03** | Isolated engine commands (`mastery`, `graph`, `scheduler`): each talks to **one** engine Tag. The CLI module may load corpus or log; it must not import the other two engines. | prose for the three commands; import half is example under INV-C-CLI-01 |
| **INV-C-CLI-04** | The program is named `retention`. This version's artifact is Bun compile → one standalone program. `bun src/cli/main.ts` is a developer stand-in, not the product. | partial — completions `#compdef retention` is example; binary production is prose |
| **INV-C-CLI-05** | Client language (Bun TypeScript vs Rust) is not a construction invariant. Engine stays TypeScript. A later Rust client still speaks the same commands and consent rules and does not reimplement mastery / graph / scheduler. | prose — constraint on a hypothetical adapter |

### Store / codec

| Id | Claim | Encoding |
| --- | --- | --- |
| **INV-C-STO-01** | The store adapter owns bytes and framing. It returns opaque records. Interpretation sits above the store. Encoded review payloads do not carry `due`, `interval`, or `brightness`. | example — `src/store/memory.test.ts`, `src/codec/layers.test.ts` |

### Any new module

| Id | Claim | Encoding |
| --- | --- | --- |
| **INV-C-MOD-01** | A new module ships checks for the catalog ids that apply at **its** seam. Generation means `effect/FastCheck` at engine-shaped seams. The interface is the test surface. | prose (meta) until the construction scan below is installed |
| **INV-C-MOD-02** | Adaptive parameters are learned, not configured. Do not add the knobs a calibrator would replace. Clients keep only fixed preferences and record what happened. | prose |

## New module

A module is **done** when callers and tests cross the same seam, and every catalog id that applies at that seam has a cited check. Adding a directory is not done. Parked product (Forester, calibrator, a Rust client) still follows this when its map opens — this section does not unpark them.

Do not mint new product law in the module. New `INV-*` ids only when a locked spec (`KEY_DECISIONS.md` or a component spec) already states the claim.

### Which ids apply

**Every new module**

- `INV-C-MOD-01` — checks at this seam
- `INV-C-MOD-02` — no learned-parameter knobs
- `INV-B-LANG-01` — if it prints or prompts (titles and glossary, not folder names or card ids)

**Engine Tag** (`src/engine/<name>/`, a `Context.Tag` + Live)

- All **every** ids
- `INV-C-ENG-01`, `INV-C-ENG-02` — no sibling Tag imports; no store / corpus I/O / session / cli
- Own `INV-C-<owner>-*` (Clock / time / blindness) — follow MST / GRF / SCH
- Own `INV-B-<owner>-*` as FastCheck on Live (relations, not knobs)
- If it needs time: list Clock in `R`; never provide Clock; never `Date.now`

**Session-shaped compose** (reads stores, writes log, composes Tags)

- All **every** ids
- `INV-C-SES-01`, `INV-B-SES-01`…`04` as they apply — no Brightness/THRESHOLD math, no Clock construct, no prompt, `grade` is one event
- Does not decide due-ness or walk prerequisites itself

**CLI command or TUI surface**

- All **every** ids
- `INV-B-CLI-01`…`11` and `INV-C-CLI-01`…`04` as they apply: `[pure]`/`[impure]` labels, consent, refuse when non-interactive, no `--yes`, no env-var tree/path interface, titles not folder names
- Isolated engine command: import **one** Tag (`INV-C-CLI-03`). Session CLI still does not compute the `[0, 1]` number (`INV-C-CLI-01`)
- Examples, not generated PTY

**Later client** (Rust or otherwise — not chosen)

- `INV-C-CLI-05` — same commands and consent; does not reimplement mastery / graph / scheduler
- `INV-B-LANG-01`, `INV-B-CLI-01`…`04` (consent / refuse / no env as the interface)
- Engine stays TypeScript

**Store adapter**

- All **every** ids
- `INV-B-STO-01`, `INV-C-STO-01` — opaque records; missing file is empty history; no derived `due` / `interval` / `brightness` on the wire

**Forester (when a later map builds it)**

- All **every** ids
- Does not read the event log (`ARCHITECTURE.md`)
- Proposes; nothing lands without approval
- User-facing proposals: `INV-B-LANG-01`
- No calibrator knobs (`INV-C-MOD-02`)
- Does not import engine Tags to score the learner

### What the author must add

1. **Interface + adapter** at one seam. Tests call that interface, not a private interior.
2. **Cited checks** for every applying id: FastCheck at engine-shaped Lives; examples for CLI/TUI; source scans for construction.
3. **Isolation scan entry** if it is an engine Tag: extend `src/engine/no-cross-imports.test.ts` (or its successor) so the new directory is in the glob.
4. CLI: help line with `[pure]`/`[impure]`; impure path has consent + non-interactive refuse; no `--yes`.
5. No new `RETENTION_*` (or similar) for tree / corpus / log. `NO_COLOR` stays feel.

### What pre-commit rejects

The hook only runs `bun run typecheck` and `bun test`. It cannot see a checklist. So **done** is enforced by construction tests that `bun test` already runs. Specify these for the install session; do not add them on this map.

| If the author skips | Failing check (to add under `src/`, citing the id in `test()`) |
| --- | --- |
| New `src/engine/<name>/` not in the isolation glob | `INV-C-ENG-01` / `INV-C-ENG-02` scan — unknown engine dir, or sibling/store/cli import |
| Engine Live with no FastCheck / no `INV-B-` test name | `INV-C-MOD-01` — each `src/engine/*/live.ts` has a `live.test.ts` that imports `effect/FastCheck` and names at least one `INV-B-` |
| New top-level `src/<dir>/` not on the kind registry | `INV-C-MOD-01` — registry of kinds (`cli`, `session`, `engine`, `store`, `corpus`, `codec`, `domain`, `testing`). Unknown dir fails until classified and given the checks that kind requires |
| CLI sources import engine Tags (beyond one isolated command module) or `THRESHOLD` | `INV-C-CLI-01` / `INV-C-CLI-03` |
| `--yes` in `src/cli` | `INV-C-CLI-02` |
| `RETENTION_` env used to pick tree or paths | `INV-B-CLI-01` |
| Typecheck hole on `*.test.ts` | hook `typecheck` — tests included |

Existing engine FastCheck failures already fail the hook. A new Tag that never grows a property suite fails the Live-file scan, not a human review.

---

## Excluded

Not ids. Same files mention them.

| Item | Why |
| --- | --- |
| Name "Brightness", numeric `THRESHOLD`, FSRS `w` | Placeholders. Compare **relations** are harvested; the number is not. |
| Session node-fold TODO | Placeholder, not a claim about how a concept is known |
| `--yes` as a future flag | Parked. **This version has no `--yes`** is `INV-C-CLI-02`. |
| Env-var config as a future interface | Parked. **This version has no user-facing env-var interface** is `INV-B-CLI-01`. |
| Forester, capture, curation, calibrator, dormancy, one-card review loop, practice cards, Grader | Do not build this version |
| Tag-level `--trace` | Parked |
| TypeScript vs Rust client | Allowed, not chosen — see `INV-C-CLI-05` |
| Session-level events for a calibrator | Open, not decided |

---

## Still prose (highest value to encode next)

Locked in spec, untested or only implicit:

1. **INV-B-CLI-05 / INV-B-SES-02** — `queue` (and any other pure command) on a missing log creates no file and no directory.
2. **INV-B-SES-01** — Session never prompts.
3. **INV-B-CLI-01** — no user-facing env-var interface for tree / paths.
4. **INV-C-CLI-02** — no `--yes`.
5. **INV-B-CLI-06** — tree choice is per invocation, not process-sticky.
6. **INV-C-CLI-03** — isolated engine commands, one Tag each.
7. **INV-C-MOD-01 / INV-C-MOD-02** — construction scans in the table above, not yet in `src/`.
8. **INV-B-SES-04** (recall-then-derivation) and **INV-B-MST-04** — specified, example-only; good FastCheck promotions.

Existing FastCheck already covers INV-B-MST-01…03, INV-B-GRF-01…04, INV-B-SCH-01…02. Cite those ids from the `test()` names when those files are next touched. Do not rewrite the engine suites on this map.

## Harvest

Wording and ids come from [Candidate invariants from specs and code](https://github.com/Galz648/Retention/issues/37) ([`research/candidate-invariants.md`](https://github.com/Galz648/Retention/blob/research/candidate-invariants/research/candidate-invariants.md)). Tool and hook contract: [PBT methodology and tool contract](https://github.com/Galz648/Retention/issues/35) ([`research/pbt-methodology.md`](https://github.com/Galz648/Retention/blob/research/pbt-methodology/research/pbt-methodology.md)).
